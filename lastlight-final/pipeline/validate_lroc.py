"""Validation against real photographs: our skyline + SPICE Sun vs the LROC WAC time-weighted illumination map.

LROC map (Speyerer & Robinson 2013): share of 3,807 WAC images, 15 Feb 2010 -> 5 Feb 2011, in which each 100 m pixel
of 88-90 S is sunlit. Of the nine Artemis III regions only de Gerlache Rim 2 (88.65 S) lies inside that map.

We recompute, hour by hour over the same dates, the share of time the Sun is above OUR computed skyline at that
point (sites.json horizon, 2 m mast) and compare it with the map. The region position is good to about 3 km, so
the LROC value is reported at the point and as the range inside a 3 km circle around it.

    python3 pipeline/validate_lroc.py [path/to/WAC_POLE_ILL_TWI_SOUTH_100M.TIF] [kernel_dir]

The 8-bit GeoTIFF (EXTRAS/BROWSE) stores the percentage as 0..255 (255 = always lit): value / 255 x 100.
Writes docs/validation-lroc.json.
"""
import json
import os
import sys
import urllib.request

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ephem  # noqa: E402
from config import R_MOON_M  # noqa: E402

URL = ("https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/EXTRAS/BROWSE/WAC_POLE/"
       "WAC_POLE_ILL_TWI_SOUTH/WAC_POLE_ILL_TWI_SOUTH_100M.TIF")
SITE = "de-gerlache-rim-2"
RADIUS_M = 3000.0


def stereo_xy(lat, lon):
    """South polar stereographic on the 1,737.4 km sphere, true scale at the pole (the map's projection)."""
    rho = 2 * R_MOON_M * np.tan(np.radians(90 + lat) / 2)
    return rho * np.sin(np.radians(lon)), rho * np.cos(np.radians(lon))


def main():
    tif = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, ".cache", "WAC_POLE_ILL_TWI_SOUTH_100M.TIF")
    kdir = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, ".cache", "kernels")
    if not os.path.exists(tif):
        os.makedirs(os.path.dirname(tif), exist_ok=True)
        urllib.request.urlretrieve(URL, tif)
    import rasterio

    sites = json.load(open(os.path.join(HERE, "..", "web", "public", "data", "sites.json")))["sites"]
    s = next(x for x in sites if x["id"] == SITE)
    prof = np.asarray(s["horizon"]["mast_2m"], dtype=float)

    # --- ours: hourly over the LROC period -------------------------------------------------------------------
    os.makedirs(kdir, exist_ok=True)
    ts, eph, frame = ephem.load_frame(kdir)
    hours = np.arange(np.datetime64("2010-02-15T00", "h"), np.datetime64("2011-02-06T00", "h"))
    dt = hours.astype("datetime64[s]").astype(object)
    t = ts.utc([d.year for d in dt], [d.month for d in dt], [d.day for d in dt], [d.hour for d in dt])
    sun_me, earth_me = ephem.body_vectors(ts, eph, frame, t)
    sky = ephem.site_sky(sun_me, earth_me, s["lat"], s["lon"], s["elevation_m"])
    frac = ephem.disk_fraction(sky["sun_el"], ephem.horizon_at(prof, sky["sun_az"]), sky["sun_rad"])
    ours_any = float((frac > 0).mean() * 100)      # any part of the disc above the skyline
    ours_half = float((frac >= 0.5).mean() * 100)  # at least half the disc (our "in view" rule)
    ours_mean = float(frac.mean() * 100)           # time-averaged visible share of the disc

    # --- LROC ------------------------------------------------------------------------------------------------
    with rasterio.open(tif) as r:
        a = r.read(1).astype(float) / 255 * 100
        x, y = stereo_xy(s["lat"], s["lon"])
        row, col = r.index(x, y)
        at_point = float(a[row, col])
        rr, cc = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        xs, ys = r.xy(rr.ravel(), cc.ravel())
        d = np.hypot(np.asarray(xs) - x, np.asarray(ys) - y).reshape(a.shape)
        ring = a[d <= RADIUS_M]

    out = {
        "site": SITE, "lat": s["lat"], "lon": s["lon"], "period_utc": ["2010-02-15", "2011-02-05"], "hours": int(len(hours)),
        "ours_pct_any_sun": round(ours_any, 1), "ours_pct_half_disc": round(ours_half, 1), "ours_pct_mean_disc": round(ours_mean, 1),
        "lroc_pct_at_point": round(at_point, 1),
        "lroc_pct_within_3km": {"min": round(float(ring.min()), 1), "p25": round(float(np.percentile(ring, 25)), 1),
                                "median": round(float(np.median(ring)), 1), "p75": round(float(np.percentile(ring, 75)), 1),
                                "max": round(float(ring.max()), 1), "pixels": int(ring.size)},
        "lroc_product": "WAC_POLE_ILL_TWI_SOUTH_100M (8-bit browse GeoTIFF), Speyerer & Robinson 2013", "url": URL,
    }
    print(json.dumps(out, indent=1))
    json.dump(out, open(os.path.join(HERE, "..", "docs", "validation-lroc.json"), "w"), indent=1)


if __name__ == "__main__":
    main()
