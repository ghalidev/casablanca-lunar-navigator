"""Terrain horizons at published reference points, to check our sunlight numbers.

Reference: Bussey, D.B.J., et al. (2010), "Illumination conditions of the south pole of the Moon
derived using Kaguya topography", Icarus 208, 558-564, doi:10.1016/j.icarus.2010.03.028.
Table 2 gives the 2020 mean illumination of 6 points (Kaguya LALT topography, 12 h steps).

For each point we compute our horizon (same method as scripts/terrain_horizons.py) at:
  - the published coordinates, mast 0 m and 2 m;
  - the nearest LOLA summit, found by climbing uphill from the published point (Bussey's points
    are local topographic maxima, and two DEMs from different missions place a summit a few
    hundred metres apart), mast 0 m and 2 m.
Writes scripts/validation/bussey2010_points.json; then run
  node --experimental-strip-types scripts/validate_illumination.mts
Usage: python3 -I scripts/validate_illumination.py <path/to/ldem_64_uint.tif>
"""

import json
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from terrain_horizons import R_M, dest, horizon_for, load_dem, make_sampler  # noqa: E402


# name, lat, lon (east-positive), Bussey 2010 Table 2 "2020 Mean" (%)
POINTS = [
    ("Point A (Shackleton rim)", -89.68, -166.0, 81),
    ("Point B (ridge near Shackleton)", -89.44, -141.8, 82),
    ("Point C (de Gerlache rim)", -88.71, -68.7, 85),
    ("Point D (ridge off Shackleton rim)", -88.79, 124.5, 86),
    ("Point M1 (Malapert)", -86.04, 2.7, 74),
    ("Point M2 (Malapert)", -86.00, -2.9, 74),
]


def nearest_summit(sample, lat0: float, lon0: float, px_km: float) -> tuple[float, float, float]:
    """Climb uphill from (lat0, lon0) to the nearest DEM summit; returns it and its distance (km)."""
    step_m = px_km * 1000 / 4
    az = np.radians(np.arange(0, 360, 15.0))
    lat, lon = lat0, lon0
    h = float(sample(np.array([lat]), np.array([lon]))[0])
    for _ in range(400):
        la, lo = dest(lat, lon, az, np.full(az.size, step_m))
        hh = sample(la, lo)
        i = int(np.argmax(hh))
        if hh[i] <= h:
            break
        lat, lon, h = float(la[i]), float(lo[i]), float(hh[i])
    p0, p1 = math.radians(lat0), math.radians(lat)
    c = math.sin(p0) * math.sin(p1) + math.cos(p0) * math.cos(p1) * math.cos(math.radians(lon - lon0))
    return lat, lon, math.acos(min(1.0, c)) * R_M / 1000


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    tif = Path(sys.argv[1])
    dem, ppd, top = load_dem(tif)
    px_km = math.pi * R_M / 180.0 / ppd / 1000.0
    sample = make_sampler(dem, ppd, top)
    out = []
    for name, lat, lon, ref in POINTS:
        hl, hn, moved = nearest_summit(sample, lat, lon, px_km)
        for where, (la, lo) in (("published", (lat, lon)), ("nearest LOLA summit", (hl, hn))):
            for mast in (0.0, 2.0):
                hor, h, _ = horizon_for(sample, la, lo, px_km, mast)
                out.append({
                    "name": name, "refPct": ref, "where": where, "movedKm": 0.0 if where == "published" else round(moved, 2),
                    "mastM": mast, "lat": round(la, 4), "lon": round(lo, 4), "heightM": round(h + mast, 1), "horizon": hor,
                })
        h0 = float(sample(np.array([lat]), np.array([lon]))[0])
        h1 = float(sample(np.array([hl]), np.array([hn]))[0])
        print(f"{name:36s} published h={h0:6.0f} m; nearest summit {moved:.2f} km away, h={h1:6.0f} m")
    path = Path(__file__).resolve().parent / "validation" / "bussey2010_points.json"
    meta = {"dem": f"{tif.name} ({ppd:g} px/deg, ~{px_km * 1000:.0f} m)", "reference": "Bussey et al. 2010, Icarus 208, Table 2"}
    path.write_text(json.dumps({"meta": meta, "points": out}) + "\n")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
