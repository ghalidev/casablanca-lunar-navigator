"""Terrain horizons for every site in public/data/sites.json, from NASA LOLA elevation.

Input: a LOLA global elevation GeoTIFF from the NASA SVS CGI Moon Kit (svs.gsfc.nasa.gov/4720):
  ldem_16_uint.tif (16 px/deg, 33 MB) or ldem_64_uint.tif (64 px/deg, 530 MB).
  Equirectangular, 0 deg longitude centred, uint16 half-metres with +20000 offset, heights
  relative to the 1737.4 km sphere. Downloaded, never committed.

For each site and each azimuth 0..359 deg (0 = local north, clockwise), we march along the
great circle out to MAX_KM and take the highest elevation angle of the terrain, seen from an
eye MAST_M above the DEM surface at the site, including the Moon's curvature:
  el = atan2((R + h) cos(theta) - (R + h0), (R + h) sin(theta)),  theta = d / R.
Writes `horizon` (360 values, deg), `heightM` and `horizonSource` back into sites.json.

The lander point of each site is the highest DEM point inside NASA's region box (boxes from
scripts/digitize_regions.py); the digitized box centre is kept as regionLat/regionLon.

Usage (after scripts/digitize_regions.py, which rewrites sites.json without horizons):
  python3 -I scripts/terrain_horizons.py <path/to/ldem_XX_uint.tif>
Needs numpy + Pillow only.
"""

import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from digitize_regions import BOXES, px_to_latlon  # noqa: E402  (NASA region boxes, map pixels)

R_M = 1737400.0
MAST_M = 2.0
MAX_KM = 200.0
LAT_CROP = -70.0  # keep only the rows south of this latitude (rays never go further north)


def load_dem(path: Path) -> tuple[np.ndarray, float, int]:
    Image.MAX_IMAGE_PIXELS = None
    im = Image.open(path)
    w, h = im.size
    ppd = w / 360.0
    if abs(h - 180 * ppd) > 1:
        raise SystemExit(f"{path}: not a global equirectangular grid ({w}x{h})")
    top = int(math.floor((90 - LAT_CROP) * ppd))
    crop = im.crop((0, top, w, h))
    dem = np.asarray(crop, dtype=np.float32) * 0.5 - 10000.0
    return dem, ppd, top


def make_sampler(dem: np.ndarray, ppd: float, top: int):
    rows, cols = dem.shape

    def sample(lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
        x = (lon + 180.0) * ppd - 0.5
        y = (90.0 - lat) * ppd - 0.5 - top
        y = np.clip(y, 0, rows - 1.001)
        x0 = np.floor(x).astype(np.int64)
        y0 = np.floor(y).astype(np.int64)
        fx = x - x0
        fy = y - y0
        x0 %= cols
        x1 = (x0 + 1) % cols
        y1 = np.minimum(y0 + 1, rows - 1)
        a = dem[y0, x0] * (1 - fx) + dem[y0, x1] * fx
        b = dem[y1, x0] * (1 - fx) + dem[y1, x1] * fx
        return a * (1 - fy) + b * fy

    return sample


def distances_km(px_km: float) -> np.ndarray:
    # Fine steps near the site (half a pixel), then growing 1% per step out to MAX_KM.
    near = np.arange(px_km / 2, 20.0, px_km / 2)
    far = [20.0]
    while far[-1] < MAX_KM:
        far.append(far[-1] * 1.01)
    return np.concatenate([near, np.array(far)])


def horizon_for(sample, lat0: float, lon0: float, px_km: float) -> tuple[list[float], float, list[float]]:
    d = distances_km(px_km) * 1000.0
    az = np.radians(np.arange(360.0))[:, None]
    th = (d / R_M)[None, :]
    p0 = math.radians(lat0)
    l0 = math.radians(lon0)
    # destination point along bearing az at angular distance th
    sp = np.sin(p0) * np.cos(th) + np.cos(p0) * np.sin(th) * np.cos(az)
    lat = np.degrees(np.arcsin(np.clip(sp, -1, 1)))
    lon = np.degrees(l0 + np.arctan2(np.sin(az) * np.sin(th) * np.cos(p0), np.cos(th) - np.sin(p0) * sp))
    lon = (lon + 180.0) % 360.0 - 180.0
    h = sample(lat, lon)
    h0 = float(sample(np.array([lat0]), np.array([lon0]))[0]) + MAST_M
    el = np.degrees(np.arctan2((R_M + h) * np.cos(th) - (R_M + h0), (R_M + h) * np.sin(th)))
    k = np.argmax(el, axis=1)
    hor = el[np.arange(360), k]
    dist_of_max = d[k] / 1000.0
    return [round(float(v), 3) for v in hor], h0 - MAST_M, [float(v) for v in dist_of_max]


def dest(lat0: float, lon0: float, az: np.ndarray, d_m: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    p0, l0, th = math.radians(lat0), math.radians(lon0), d_m / R_M
    sp = np.sin(p0) * np.cos(th) + np.cos(p0) * np.sin(th) * np.cos(az)
    lat = np.degrees(np.arcsin(np.clip(sp, -1, 1)))
    lon = np.degrees(l0 + np.arctan2(np.sin(az) * np.sin(th) * np.cos(p0), np.cos(th) - np.sin(p0) * sp))
    return lat, (lon + 180.0) % 360.0 - 180.0


def highest_in_box(sample, sid: str, px_km: float) -> tuple[float, float]:
    """Highest DEM point inside NASA's region box for this site (box from the official map)."""
    _, x0, x1, y0, y1 = BOXES[sid]
    km_per_map_px = 50 / 89.5
    n = lambda a, b: max(2, int((b - a) * km_per_map_px / (px_km / 4)) + 1)
    xs = np.linspace(x0 + 1, x1 - 1, n(x0, x1))  # +-1 px: inside the drawn yellow line
    ys = np.linspace(y0 + 1, y1 - 1, n(y0, y1))
    pts = [px_to_latlon(x, y) for y in ys for x in xs]
    lat = np.array([p[0] for p in pts])
    lon = np.array([p[1] for p in pts])
    h = sample(lat, lon)
    i = int(np.argmax(h))
    return float(lat[i]), float(lon[i])


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    tif = Path(sys.argv[1])
    dem, ppd, top = load_dem(tif)
    px_km = math.pi * R_M / 180.0 / ppd / 1000.0
    sample = make_sampler(dem, ppd, top)

    path = Path(__file__).resolve().parent.parent / "public" / "data" / "sites.json"
    data = json.loads(path.read_text())
    src = (
        f"LOLA elevation, NASA SVS CGI Moon Kit {tif.name} ({ppd:g} px/deg, ~{px_km * 1000:.0f} m), "
        f"{MAST_M:g} m mast, max {MAX_KM:g} km, curvature included; point = highest LOLA ground "
        f"inside NASA's region box (scripts/terrain_horizons.py)"
    )
    print(f"DEM {tif.name}: {ppd:g} px/deg, {px_km * 1000:.0f} m/px in latitude")
    for s in data["sites"]:
        # Always start from the digitized region centre, so re-running never drifts.
        s.setdefault("regionLat", s["lat"])
        s.setdefault("regionLon", s["lon"])
        lat, lon = highest_in_box(sample, s["id"], px_km)
        moved = float(np.hypot(*[(a - b) for a, b in zip(
            [(90 + lat) * math.sin(math.radians(lon)), (90 + lat) * math.cos(math.radians(lon))],
            [(90 + s["regionLat"]) * math.sin(math.radians(s["regionLon"])), (90 + s["regionLat"]) * math.cos(math.radians(s["regionLon"]))],
        )])) * math.pi / 180 * R_M / 1000
        s["lat"], s["lon"] = round(lat, 4), round(lon, 4)
        s["source"] = (
            "Highest LOLA point inside NASA's region box on the official 9-region map "
            "(NASA/GSFC/ASU/JSC/AGDT; LPSC 2026, NTRS 20250011660); see docs/assumptions.md A7, A11"
        )
        hor, h_site, dmax = horizon_for(sample, s["lat"], s["lon"], px_km)
        s["horizon"] = hor
        s["heightM"] = round(h_site, 1)
        s["horizonSource"] = src
        a = np.array(hor)
        print(
            f"{s['id']:22s} h={h_site:7.0f} m  horizon min {a.min():5.2f} mean {a.mean():5.2f} max {a.max():5.2f} deg"
            f" (az {int(a.argmax())}, {dmax[int(a.argmax())]:.0f} km)  moved {moved:.1f} km"
        )
    data["mock"] = False
    path.write_text(json.dumps(data, indent=1) + "\n")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
