"""Generate MOCK data for the LASTLIGHT data contract.

Everything written here is synthetic (mock = true, params_ref = "mock").
Shapes and orders of magnitude look plausible so the front can be built,
but NO number produced here may ever be shown as a result.

Usage:  python contracts/make_mock.py            (writes contracts/mock/)
Stdlib only, deterministic (fixed seed).
"""
from __future__ import annotations

import json
import math
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent / "mock"
SEED = 20261114
YEAR = 2027                      # series are mocked for one year only
STEP_H = 1
SUN_R_DEG = 0.267
EARTH_R_DEG = 0.95
SOLAR_CONST = 1361.0
SYNODIC_H = 29.530589 * 24
DRACONIC_YEAR_H = 346.62 * 24
ANOMALISTIC_H = 27.554550 * 24
DRACONIC_MONTH_H = 27.212221 * 24

# Placeholder positions — NOT the real region coordinates (position_source = "mock").
SITES = [
    ("peak-near-cabeus-b", "Peak near Cabeus B", -84.9, -45.0),
    ("haworth", "Haworth", -86.8, -10.0),
    ("malapert-massif", "Malapert Massif", -85.9, 0.0),
    ("mons-mouton-plateau", "Mons Mouton Plateau", -85.4, 35.0),
    ("mons-mouton", "Mons Mouton", -84.6, 30.0),
    ("nobile-rim-1", "Nobile Rim 1", -85.3, 40.0),
    ("nobile-rim-2", "Nobile Rim 2", -84.1, 60.0),
    ("de-gerlache-rim-2", "de Gerlache Rim 2", -88.6, -70.0),
    ("slater-plain", "Slater Plain", -88.0, 110.0),
]


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def disk_fraction(center_el: float, horizon_el: float, radius: float) -> float:
    """Fraction of a disk above a locally flat horizon line."""
    d = (center_el - horizon_el) / radius
    if d >= 1:
        return 1.0
    if d <= -1:
        return 0.0
    return 1 - (math.acos(d) - d * math.sqrt(1 - d * d)) / math.pi


def horizon_at(profile: list[float], az: float) -> float:
    x = (az % 360) / 0.5
    i = int(x) % 720
    f = x - int(x)
    return profile[i] * (1 - f) + profile[(i + 1) % 720] * f


def make_horizon(rng: random.Random) -> tuple[list[float], list[float]]:
    harmonics = [(k, rng.uniform(0.05, 0.9) / k ** 0.8, rng.uniform(0, 2 * math.pi)) for k in range(1, 25)]
    base = rng.uniform(0.2, 1.2)
    m2 = []
    for i in range(720):
        a = math.radians(i * 0.5)
        v = base + sum(amp * math.sin(k * a + ph) for k, amp, ph in harmonics)
        m2.append(round(max(-0.8, v), 3))
    m10 = [round(v - 0.04 - 0.02 * rng.random(), 3) for v in m2]
    return m2, m10


def make_series(site_id: str, lat: float, lon: float, m2: list[float], rng: random.Random) -> dict:
    t0 = datetime(YEAR, 1, 1, tzinfo=timezone.utc)
    n = int((datetime(YEAR + 1, 1, 1, tzinfo=timezone.utc) - t0).total_seconds() // 3600 // STEP_H)
    colat = 90 + lat
    ph_s, ph_d, ph_e = rng.uniform(0, 2 * math.pi), rng.uniform(0, 2 * math.pi), rng.uniform(0, 2 * math.pi)
    keys = ["sun_el", "sun_az", "earth_el", "earth_az", "sun_frac", "earth_frac", "irradiance_wm2"]
    out = {k: [] for k in keys}
    for i in range(n):
        h = i * STEP_H
        sun_az = (360 * h / SYNODIC_H + math.degrees(ph_s)) % 360
        decl = 1.54 * math.sin(2 * math.pi * h / DRACONIC_YEAR_H + ph_d)
        sun_el = decl + colat * math.cos(math.radians(sun_az - lon))
        lib_lon = 7.0 * math.sin(2 * math.pi * h / ANOMALISTIC_H + ph_e)
        lib_lat = 6.7 * math.sin(2 * math.pi * h / DRACONIC_MONTH_H + ph_e / 2)
        earth_az = (lon + 180 + lib_lon) % 360
        earth_el = lib_lat + colat * math.cos(math.radians(lon + lib_lon)) - 0.6
        sf = disk_fraction(sun_el, horizon_at(m2, sun_az), SUN_R_DEG)
        ef = disk_fraction(earth_el, horizon_at(m2, earth_az), EARTH_R_DEG)
        out["sun_el"].append(round(sun_el, 3))
        out["sun_az"].append(round(sun_az, 2))
        out["earth_el"].append(round(earth_el, 3))
        out["earth_az"].append(round(earth_az, 2))
        out["sun_frac"].append(round(sf, 3))
        out["earth_frac"].append(round(ef, 3))
        out["irradiance_wm2"].append(round(SOLAR_CONST * math.cos(math.radians(sun_el)) * sf, 1))
    return {"site_id": site_id, "mock": True, "params_ref": "mock", "t0": iso(t0), "step_h": STEP_H,
            "n": n, "mast_m": 2, **out}


def make_survival(site_id: str, rng: random.Random) -> dict:
    start = datetime(2027, 1, 1, tzinfo=timezone.utc)
    end = datetime(2031, 1, 1, tzinfo=timezone.utc)
    quality = rng.uniform(0.6, 1.12)
    ph = rng.uniform(0, 2 * math.pi)
    windows = []
    d = start
    while d < end:
        h = (d - start).total_seconds() / 3600
        s = 0.5 + 0.5 * math.sin(2 * math.pi * h / SYNODIC_H + ph)
        season = 0.5 + 0.5 * math.sin(2 * math.pi * h / DRACONIC_YEAR_H + ph / 3)
        p = max(0.0, min(0.995, quality * (0.15 + 0.85 * s ** 2) * (0.75 + 0.25 * season) + rng.gauss(0, 0.02)))
        windows.append({
            "landing_utc": iso(d),
            "p_survive_14d": round(p, 3),
            "p_comm_ok": round(max(0.0, min(1.0, 0.3 + 0.6 * season + rng.gauss(0, 0.05))), 3),
            "median_days_alive": round(min(14.0, 0.5 + 16 * p ** 1.5), 2),
            "slip_tolerance_days": int(max(0, min(30, round((p - 0.9) * 120)))) if p >= 0.9 else 0,
        })
        d += timedelta(days=1)
    best = max(windows, key=lambda w: w["p_survive_14d"])
    landers = []
    for _ in range(2000):
        r_sigma = 180.0
        dx, dy = rng.gauss(0, r_sigma), rng.gauss(0, r_sigma)
        toppled = rng.random() < 0.08
        tilt = rng.uniform(60, 90) if toppled else abs(rng.gauss(0, 4))
        risk = (math.hypot(dx, dy) / 600) + (0.8 if toppled else 0) + (1 - best["p_survive_14d"])
        died = None if rng.random() > min(1.0, risk) else round(rng.uniform(1, 14 * 24), 1)
        landers.append({"dx_m": round(dx, 1), "dy_m": round(dy, 1), "tilt_deg": round(min(90, tilt), 1),
                        "yaw_deg": round(rng.uniform(0, 360), 1), "died_at_h": died})
    return {"site_id": site_id, "mock": True, "params_ref": "mock", "windows": windows,
            "ghost_landers_sample": {"landing_utc": best["landing_utc"], "sim_duration_h": 14 * 24,
                                     "landers": landers}}


def main() -> None:
    rng = random.Random(SEED)
    now = iso(datetime(2026, 11, 14, tzinfo=timezone.utc))
    (OUT / "series").mkdir(parents=True, exist_ok=True)
    (OUT / "survival").mkdir(parents=True, exist_ok=True)
    sites, all_windows = [], []
    for sid, name, lat, lon in SITES:
        m2, m10 = make_horizon(rng)
        sites.append({"id": sid, "name": name, "lat": lat, "lon": lon,
                      "elevation_m": round(rng.uniform(-1500, 6000), 0), "position_source": "mock",
                      "horizon": {"az_step_deg": 0.5, "mast_2m": m2, "mast_10m": m10},
                      "validation": {"lroc_illum_pct": None, "model_illum_pct": None}})
        series = make_series(sid, lat, lon, m2, rng)
        (OUT / "series" / f"{sid}_{YEAR}.json").write_text(json.dumps(series, separators=(",", ":")))
        surv = make_survival(sid, rng)
        (OUT / "survival" / f"{sid}.json").write_text(json.dumps(surv, separators=(",", ":")))
        all_windows += [dict(w, site_id=sid) for w in surv["windows"]]
    (OUT / "sites.json").write_text(json.dumps(
        {"generated_at": now, "mock": True, "params_ref": "mock", "sites": sites}, separators=(",", ":")))
    passing = sorted((w for w in all_windows if w["p_survive_14d"] >= 0.95),
                     key=lambda w: (-w["p_survive_14d"], -w["slip_tolerance_days"], w["landing_utc"]))[:10]
    top10 = {"generated_at": now, "mock": True, "params_ref": "mock",
             "criteria": {"survive_days": 14, "p_threshold": 0.95,
                          "from_utc": "2027-01-01T00:00:00Z", "to_utc": "2031-01-01T00:00:00Z"},
             "windows": [dict(w, rank=i + 1) for i, w in enumerate(passing)]}
    (OUT / "top10.json").write_text(json.dumps(top10, indent=2) + "\n")
    print(f"mock written to {OUT}")


if __name__ == "__main__":
    main()
