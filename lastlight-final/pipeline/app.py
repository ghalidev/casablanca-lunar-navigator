"""LASTLIGHT pipeline on Modal.

    modal run pipeline/app.py::fetch_all          # once: DEMs + SPICE kernels into the Volume
    modal run pipeline/app.py::selftest           # frame/orientation checks on the real DEM
    modal run pipeline/app.py::main               # horizons, Sun/Earth, survival -> web/public/data

Raw terrain and kernels stay in the Modal Volume `lastlight-data`; only compressed JSON reaches git.
"""
import json
import os
import sys

import modal

HERE = os.path.dirname(os.path.abspath(__file__))
app = modal.App("lastlight")
vol = modal.Volume.from_name("lastlight-data", create_if_missing=True)
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libexpat1")
    .pip_install("numpy", "numba", "rasterio", "skyfield", "pyproj", "requests")
    .add_local_dir(HERE, remote_path="/root/pipeline", ignore=[".venv", ".cache", "__pycache__", "*.pyc"])
)
DATA = "/data"


def _setup():
    if "/root/pipeline" not in sys.path:
        sys.path.insert(0, "/root/pipeline")


# ---------------------------------------------------------------------------------------------- downloads
@app.function(image=image, volumes={DATA: vol}, timeout=3600, cpu=4)
def fetch(name: str, url: str) -> dict:
    """Parallel ranged download: the NASA server gives ~0.4 MB/s per connection, so many connections in parallel."""
    import time
    from concurrent.futures import ThreadPoolExecutor

    import requests

    path = f"{DATA}/{name}"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    head = requests.head(url, allow_redirects=True, timeout=60)
    size = int(head.headers.get("content-length", 0))
    if os.path.exists(path) and (size == 0 or os.path.getsize(path) == size):
        return {"name": name, "bytes": os.path.getsize(path), "cached": True}
    part = path + ".part"
    with open(part, "wb") as f:
        f.truncate(size)
    chunk = 32 << 20
    ranges = [(o, min(o + chunk, size) - 1) for o in range(0, size, chunk)]
    t0 = time.time()

    def grab(rng):
        a, b = rng
        for attempt in range(6):
            try:
                r = requests.get(url, headers={"Range": f"bytes={a}-{b}"}, timeout=180)
                r.raise_for_status()
                if len(r.content) != b - a + 1:
                    raise IOError("short read")
                with open(part, "r+b") as f:
                    f.seek(a)
                    f.write(r.content)
                return len(r.content)
            except Exception:
                time.sleep(2 * (attempt + 1))
        raise IOError(f"range {a}-{b} failed")

    with ThreadPoolExecutor(48) as ex:
        done = sum(ex.map(grab, ranges))
    assert done == size, (done, size)
    os.replace(part, path)
    vol.commit()
    return {"name": name, "bytes": size, "seconds": round(time.time() - t0)}


@app.local_entrypoint()
def fetch_all():
    _setup_local()
    import config

    jobs = [("dem/ldem_20m.tif", config.DEM_20M_URL), ("dem/ldem_240m.tif", config.DEM_240M_URL)]
    spice = fetch_spice.spawn()
    for r in fetch.starmap(jobs):
        print(r)
    print(spice.get())


@app.function(image=image, volumes={DATA: vol}, timeout=1800)
def fetch_spice() -> dict:
    """NAIF kernels through Skyfield's own loader (it knows the current URLs), cached in the Volume."""
    _setup()
    import ephem

    os.makedirs(f"{DATA}/spice", exist_ok=True)
    ephem.load_frame(f"{DATA}/spice")
    vol.commit()
    return {"spice": sorted(os.listdir(f"{DATA}/spice"))}


def _setup_local():
    if HERE not in sys.path:
        sys.path.insert(0, HERE)


# ---------------------------------------------------------------------------------------------- selftest
@app.function(image=image, volumes={DATA: vol}, timeout=1800, cpu=4, memory=8192)
def selftest() -> dict:
    """Does our reading of the DEM match known features? Malapert Mountain is a peak, Cabeus a deep crater."""
    _setup()
    import numpy as np
    import rasterio

    import config
    from geo import stereo_xy

    out = {}
    with rasterio.open(f"{DATA}/dem/ldem_240m.tif") as d:
        a = d.read(1)
        x0, y0 = d.bounds.left, d.bounds.top
        for name, lat, lon in [("Malapert Mt", -85.99, 0.12), ("Cabeus", -84.9, -35.5), ("Shackleton", -89.9, 0.0), ("Haworth", -87.45, -5.0)]:
            x, y = stereo_xy(lat, lon)
            r, c = int((y0 - y) // 240), int((x - x0) // 240)
            win = a[r - 20 : r + 21, c - 20 : c + 21]
            out[name] = {"centre_m": float(a[r, c]), "window_min_m": float(np.nanmin(win)), "window_max_m": float(np.nanmax(win))}
    return out


# ---------------------------------------------------------------------------------------------- per-site job
@app.function(image=image, volumes={DATA: vol}, timeout=3 * 3600, cpu=8, memory=24576)
def process_site(site: dict, overrides: dict | None = None, summary: bool = False, ghost_days: bool = False, all_series: bool = False) -> dict:
    _setup()
    import time

    import numpy as np
    import rasterio
    from rasterio.windows import Window

    import config as C
    import ephem
    import horizon
    import survival

    # Warm containers are reused, so overrides must never leak into the next call: restore the module afterwards.
    saved = {k: getattr(C, k) for k in (overrides or {})}
    for key, val in (overrides or {}).items():
        setattr(C, key, val)
    try:
        return _process_site(site, summary, C, ephem, horizon, survival, ghost_days, all_series)
    finally:
        for key, val in saved.items():
            setattr(C, key, val)


def _process_site(site, summary, C, ephem, horizon, survival, ghost_days=False, all_series=False):
    import time

    import numpy as np
    import rasterio
    from rasterio.windows import Window

    from geo import local_axes_plane, scale_k, stereo_xy

    from geo import local_axes_plane, scale_k, stereo_xy

    t_start = time.time()
    log = {}
    sid, lat, lon = site["id"], site["lat"], site["lon"]
    x, y = (float(v) for v in stereo_xy(lat, lon))
    k = float(scale_k(lat))
    nvec, evec = (v.astype(np.float64) for v in local_axes_plane(lon))

    # --- DEM windows -------------------------------------------------------------------------------------
    with rasterio.open(f"{DATA}/dem/ldem_240m.tif") as d:
        far = d.read(1).astype(np.float32)
        far_origin = (d.bounds.left, d.bounds.top)
        far_res = float(d.res[0])
    pad = (C.NEAR_RADIUS_KM * 1000.0 + C.FINE_GRID_HALF_M + 1500.0) * k
    with rasterio.open(f"{DATA}/dem/ldem_20m.tif") as d:
        res = float(d.res[0])
        c0 = int((x - pad - d.bounds.left) // res)
        r0 = int((d.bounds.top - (y + pad)) // res)
        n = int(2 * pad // res)
        near = d.read(1, window=Window(c0, r0, n, n)).astype(np.float32)
        near_origin = (d.bounds.left + c0 * res, d.bounds.top - r0 * res)
        near_res = res
    log["near_shape"] = list(near.shape)
    log["near_nan"] = int(np.isnan(near).sum())

    args = (near, near_origin[0], near_origin[1], near_res, far, far_origin[0], far_origin[1], far_res)
    max_range, near_radius = C.MAX_RANGE_KM * 1000.0, C.NEAR_RADIUS_KM * 1000.0
    n_az = int(round(360.0 / C.AZ_STEP_DEG))

    # --- site horizons (2 m and 10 m masts) ---------------------------------------------------------------
    xs, ys = np.array([x]), np.array([y])
    prof = {}
    ground = 0.0
    for m in C.MASTS_M:
        p, g = horizon.grid_profiles(*args, xs, ys, k, m, nvec, evec, n_az, max_range, near_radius)
        prof[m] = p[0]
        ground = float(g[0])
    log["ground_m"] = ground
    log["horizon_max_deg_2m"] = float(prof[2.0].max())

    # --- fine grid for the landing-error Monte Carlo --------------------------------------------------------
    nx = int(round(2 * C.FINE_GRID_HALF_M / C.FINE_GRID_STEP_M)) + 1
    off = -C.FINE_GRID_HALF_M + np.arange(nx) * C.FINE_GRID_STEP_M
    ee, nn = np.meshgrid(off, off)  # rows = north offset, cols = east offset
    gx = x + (ee.ravel()[:, None] * evec[0] + nn.ravel()[:, None] * nvec[0]).ravel() * k
    gy = y + (ee.ravel()[:, None] * evec[1] + nn.ravel()[:, None] * nvec[1]).ravel() * k
    hprof, _ = horizon.grid_profiles(*args, gx, gy, k, 2.0, nvec, evec, n_az, max_range, near_radius)
    slope, aspect = horizon.grid_slopes(*args, gx, gy, k, nvec, evec, 20.0)
    log["grid_slope_deg"] = [float(np.nanpercentile(slope, q)) for q in (5, 50, 95)]
    log["t_horizon_s"] = round(time.time() - t_start, 1)

    # --- Sun and Earth, hourly 2027..2030 -------------------------------------------------------------------
    ts, eph, frame = ephem.load_frame(f"{DATA}/spice")
    t, hours = ephem.hour_times(ts, C.SURVIVAL_YEARS[0], C.SURVIVAL_YEARS[1])
    sun_me, earth_me = ephem.body_vectors(ts, eph, frame, t)
    sky = ephem.site_sky(sun_me, earth_me, lat, lon, ground)
    n_h_total = len(hours)
    n_year = int((np.datetime64(f"{C.SERIES_YEAR + 1}-01-01", "h") - np.datetime64(f"{C.SERIES_YEAR}-01-01", "h")).astype(int))
    log["max_sun_el_deg"] = float(sky["sun_el"].max())
    log["hours"] = n_h_total

    h_site = ephem.horizon_at(prof[2.0], sky["sun_az"])
    sun_frac = ephem.disk_fraction(sky["sun_el"], h_site, sky["sun_rad"])
    earth_frac = ephem.disk_fraction(sky["earth_el"], ephem.horizon_at(prof[2.0], sky["earth_az"]), sky["earth_rad"])
    irr_flux = C.S0_WM2 / sky["sun_au"] ** 2
    irradiance = irr_flux * np.cos(np.radians(np.maximum(sky["sun_el"], 0.0))) * sun_frac

    series = {
        "site_id": sid, "mock": False, "params_ref": C.PARAMS_REF, "mast_m": 2.0,
        "t0": f"{C.SERIES_YEAR}-01-01T00:00:00Z", "step_h": C.STEP_H,
        "sun_el": np.round(sky["sun_el"][:n_year], 2).tolist(),
        "sun_az": (np.round(sky["sun_az"][:n_year], 2) % 360.0).tolist(),
        "earth_el": np.round(sky["earth_el"][:n_year], 2).tolist(),
        "earth_az": (np.round(sky["earth_az"][:n_year], 2) % 360.0).tolist(),
        "sun_frac": np.round(sun_frac[:n_year], 3).tolist(),
        "earth_frac": np.round(earth_frac[:n_year], 3).tolist(),
        "irradiance_wm2": np.round(irradiance[:n_year], 1).tolist(),
    }

    if all_series:
        # Hourly series for every survival year, same fields as the shipped SERIES_YEAR file.
        out = {}
        base_h = np.datetime64(f"{C.SURVIVAL_YEARS[0]}-01-01", "h")
        for yr in range(C.SURVIVAL_YEARS[0], C.SURVIVAL_YEARS[1] + 1):
            a = int((np.datetime64(f"{yr}-01-01", "h") - base_h).astype(int))
            b = int((np.datetime64(f"{yr + 1}-01-01", "h") - base_h).astype(int))
            sl = slice(a, min(b, n_h_total))
            out[yr] = {
                "site_id": sid, "mock": False, "params_ref": C.PARAMS_REF, "mast_m": 2.0,
                "t0": f"{yr}-01-01T00:00:00Z", "step_h": C.STEP_H,
                "sun_el": np.round(sky["sun_el"][sl], 2).tolist(),
                "sun_az": (np.round(sky["sun_az"][sl], 2) % 360.0).tolist(),
                "earth_el": np.round(sky["earth_el"][sl], 2).tolist(),
                "earth_az": (np.round(sky["earth_az"][sl], 2) % 360.0).tolist(),
                "sun_frac": np.round(sun_frac[sl], 3).tolist(),
                "earth_frac": np.round(earth_frac[sl], 3).tolist(),
                "irradiance_wm2": np.round(irradiance[sl], 1).tolist(),
            }
        return {"id": sid, "series": out}

    # --- survival Monte Carlo ---------------------------------------------------------------------------------
    fs = survival.frac_tables(sky["sun_el"], sky["sun_az"], sky["sun_rad"], hprof, n_az)
    fe = survival.frac_tables(sky["earth_el"], sky["earth_az"], sky["earth_rad"], hprof, n_az)
    el_r, az_r = np.radians(sky["sun_el"]), np.radians(sky["sun_az"])
    sde = (np.cos(el_r) * np.sin(az_r)).astype(np.float32)
    sdn = (np.cos(el_r) * np.cos(az_r)).astype(np.float32)
    sdu = np.sin(el_r).astype(np.float32)
    irr = irr_flux.astype(np.float32)
    n_h = C.SURVIVE_DAYS * 24
    n_days = n_h_total // 24 - C.SURVIVE_DAYS
    day_hours = (np.arange(n_days) * 24).astype(np.int64)
    site_i = C.SITE_IDS.index(sid)
    phys = (C.LANDING_SIGMA_M, C.TILT_LIMIT_DEG, C.TILT_NOISE_DEG, C.PANEL_FACES, C.PANEL_AREA_M2, C.PANEL_EFFICIENCY, C.BATTERY_WH, C.LOAD_W)
    t1 = time.time()
    p, comm, med = survival.run_windows(
        C.SEED, site_i, day_hours, C.N_DRAWS, n_h, fs, fe, slope, aspect, nx, C.FINE_GRID_HALF_M, C.FINE_GRID_STEP_M, sde, sdn, sdu, irr, *phys)
    log["t_mc_s"] = round(time.time() - t1, 1)

    # slip tolerance: how many days later the same launch could still land at >= threshold
    ok = p >= C.P_THRESHOLD
    slip = np.zeros(n_days, dtype=int)
    run = 0
    for i in range(n_days - 1, -1, -1):
        run = run + 1 if ok[i] else 0
        slip[i] = min(max(run - 1, 0), C.MAX_SLIP_DAYS) if ok[i] else 0

    base = np.datetime64(f"{C.SURVIVAL_YEARS[0]}-01-01", "D")
    days_iso = [str(base + np.timedelta64(i, "D")) + "T00:00:00Z" for i in range(n_days)]
    windows = [
        {"landing_utc": days_iso[i], "p_survive_14d": round(float(p[i]), 3), "p_comm_ok": round(float(comm[i]), 3),
         "median_days_alive": round(float(med[i]), 2), "slip_tolerance_days": int(slip[i]), "n_draws": C.N_DRAWS}
        for i in range(n_days)
    ]

    # ghost landers: every draw of the site's best 2027 window (same draws as its probability above)
    in_year = [i for i in range(n_days) if days_iso[i].startswith(str(C.SERIES_YEAR))]
    best = max(in_year, key=lambda i: (p[i], slip[i], -i))
    g = survival.run_one(C.SEED, site_i, best, int(day_hours[best]), C.N_DRAWS, n_h, fs, fe, slope, aspect, nx, C.FINE_GRID_HALF_M, C.FINE_GRID_STEP_M, sde, sdn, sdu, irr, *phys)
    ghosts = [
        {"dx_m": round(float(r[0]), 1), "dy_m": round(float(r[1]), 1), "tilt_deg": round(float(r[2]), 1), "yaw_deg": round(float(r[3]), 1) % 360.0,
         "died_at_h": None if r[4] < 0 else round(float(r[4]), 1)}
        for r in g
    ]
    log["ghost_alive"] = sum(1 for r in g if r[4] < 0) / len(g)
    log["ghost_window_p"] = float(p[best])
    survival_file = {
        "site_id": sid, "mock": False, "params_ref": C.PARAMS_REF, "windows": windows,
        "ghost_landers_sample": ghosts, "ghost_window_utc": days_iso[best],
    }

    if ghost_days:
        # Every draw of every landing day of the shipped year, so the crash test can replay the day the user picked.
        died = survival.run_days_died(C.SEED, site_i, day_hours[: len(in_year)], C.N_DRAWS, n_h, fs, fe, slope, aspect, nx,
                                      C.FINE_GRID_HALF_M, C.FINE_GRID_STEP_M, sde, sdn, sdu, irr, *phys)
        return {"id": sid, "site_i": site_i, "nx": nx, "slope": np.round(slope, 3).tolist(), "died": died.tobytes(),
                "p": [float(v) for v in p[: len(in_year)]], "ghost_best": [[float(v) for v in r] for r in g[:5]], "best": best}

    if summary:
        return {"id": sid, "best_p": float(p.max()), "mean_p": float(p.mean()), "days_ge_95": int((p >= C.P_THRESHOLD).sum())}

    site_out = {
        "id": sid, "name": site["name"], "lat": lat, "lon": lon, "position_source": site.get("source", ""),
        "elevation_m": round(ground, 1),
        "horizon": {"az_step_deg": C.AZ_STEP_DEG, "mast_2m": np.round(prof[2.0], 2).tolist(), "mast_10m": np.round(prof[10.0], 2).tolist()},
        "validation": {"lroc_illum_pct": None, "model_illum_pct": None},
    }
    log["t_total_s"] = round(time.time() - t_start, 1)
    return {"site": site_out, "series": series, "survival": survival_file, "log": log}


# ---------------------------------------------------------------------------------------------- orchestration
@app.local_entrypoint()
def main(only: str = ""):
    _setup_local()
    import config as C
    import assemble

    regions = json.load(open(os.path.join(HERE, "regions.json")))["sites"]
    regions = [s for s in regions if not only or s["id"] in only.split(",")]
    results = list(process_site.map(regions))
    for r in results:
        print(r["site"]["id"], json.dumps(r["log"]))
    out = os.path.join(os.path.dirname(HERE), "web", "public", "data")
    assemble.write_all(results, out)
    print("params_ref", C.PARAMS_REF, "->", out)


@app.local_entrypoint()
def ghosts(only: str = ""):
    """Per-day ghost landers for SERIES_YEAR -> web/public/data/ghosts/{site}_{year}.bin + {site}_grid.json.

    .bin = uint16 little-endian [days][N_DRAWS]: death hour x 10, 65535 = alive after SURVIVE_DAYS.
    The grid file holds what the browser needs to rebuild each draw (seed, sigma, tilt noise, terrain slope).
    """
    _setup_local()
    import numpy as np

    import config as C

    regions = json.load(open(os.path.join(HERE, "regions.json")))["sites"]
    regions = [s for s in regions if not only or s["id"] in only.split(",")]
    out = os.path.join(os.path.dirname(HERE), "web", "public", "data", "ghosts")
    os.makedirs(out, exist_ok=True)
    for r in process_site.map(regions, kwargs={"ghost_days": True}):
        sid = r["id"]
        died = np.frombuffer(r["died"], dtype=np.float32).reshape(-1, C.N_DRAWS)
        alive_share = (died < 0).mean(axis=1)
        worst = float(np.abs(alive_share - np.array(r["p"])).max())
        assert worst < 1e-9, (sid, worst)
        enc = np.where(died < 0, 65535, np.clip(np.round(died * 10), 0, 65534)).astype("<u2")
        enc.tofile(os.path.join(out, f"{sid}_{C.SERIES_YEAR}.bin"))
        grid = {"site_id": sid, "params_ref": C.PARAMS_REF, "year": C.SERIES_YEAR, "days": int(died.shape[0]), "n_draws": C.N_DRAWS,
                "seed": C.SEED, "site_index": r["site_i"], "sigma_m": C.LANDING_SIGMA_M, "tilt_noise_deg": C.TILT_NOISE_DEG,
                "grid_half_m": C.FINE_GRID_HALF_M, "grid_step_m": C.FINE_GRID_STEP_M, "nx": r["nx"], "slope_deg": r["slope"],
                "check_best_day": r["best"], "check_first_draws": r["ghost_best"]}
        with open(os.path.join(out, f"{sid}_grid.json"), "w") as f:
            json.dump(grid, f, separators=(",", ":"))
        print(sid, "days", died.shape[0], "max |alive - p|", worst)


@app.local_entrypoint()
def series_all(only: str = ""):
    """Hourly Sun/Earth series for every survival year -> web/public/data/series/{site}_{year}.json."""
    _setup_local()
    regions = json.load(open(os.path.join(HERE, "regions.json")))["sites"]
    regions = [s for s in regions if not only or s["id"] in only.split(",")]
    out = os.path.join(os.path.dirname(HERE), "web", "public", "data", "series")
    for r in process_site.map(regions, kwargs={"all_series": True}):
        for yr, ser in r["series"].items():
            with open(os.path.join(out, f"{r['id']}_{yr}.json"), "w") as f:
                json.dump(ser, f, separators=(",", ":"))
        print(r["id"], sorted(r["series"]))


VARIANTS = {
    "baseline": {},
    "battery 1500 Wh": {"BATTERY_WH": 1500.0},
    "battery 4000 Wh": {"BATTERY_WH": 4000.0},
    "load 40 W": {"LOAD_W": 40.0},
    "load 90 W": {"LOAD_W": 90.0},
    "landing sigma 100 m": {"LANDING_SIGMA_M": 100.0},
    "landing sigma 400 m": {"LANDING_SIGMA_M": 400.0},
    "tilt limit 10 deg": {"TILT_LIMIT_DEG": 10.0},
    "tilt limit 20 deg": {"TILT_LIMIT_DEG": 20.0},
}


@app.local_entrypoint()
def sensitivity():
    """How much do the site rankings move when each generic-lander assumption changes? One run per variant."""
    _setup_local()
    regions = json.load(open(os.path.join(HERE, "regions.json")))["sites"]
    rows = {}
    for name, ov in VARIANTS.items():
        res = list(process_site.map(regions, kwargs={"overrides": ov, "summary": True}))
        rows[name] = {r["id"]: r for r in res}
        order = sorted(rows[name], key=lambda i: -rows[name][i]["best_p"])
        print(name, "| ranking by best p:", ", ".join(f"{i}={rows[name][i]['best_p']:.3f}" for i in order))
    json.dump(rows, open(os.path.join(os.path.dirname(HERE), "docs", "sensitivity.json"), "w"), indent=1)
