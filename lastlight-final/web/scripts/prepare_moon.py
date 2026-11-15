#!/usr/bin/env python3
"""Build the web Moon assets from NASA SVS CGI Moon Kit files (svs.gsfc.nasa.gov/4720).

Inputs (downloaded, never committed):
  lroc_color_poles_4k.tif   LROC WAC color, 4096x2048 equirectangular, 0° lon centered
  ldem_16_uint.tif          LOLA elevation, 16 px/deg, uint16 half-meters, +20000 offset
  ldem_4_uint.tif           LOLA elevation, 4 px/deg, same encoding
Outputs (web/public/moon/):
  color_4k.jpg, color_2k.jpg   globe color
  globe_height.png             8-bit globe displacement (4 px/deg) + range in meta.json
  pole_color.jpg               south pole, azimuthal equidistant, 0..R_DEG from the pole
  pole_height.png              same grid, height packed in R (high byte) and G (low byte)
  meta.json                    ranges and projection, read by the web app

Projection of the pole tiles: x = r sin(lon), y = -r cos(lon) with r = (90 + lat) / R_DEG,
0° longitude at the top, 90° E to the right (same as web/src/lib/geo.ts polarXY).

Usage: python3 -I web/scripts/prepare_moon.py <download_dir> web/public/moon
"""
import json
import sys
from pathlib import Path

import numpy as np
import tifffile
from PIL import Image

R_DEG = 7.5  # pole tile covers 82.5°S..90°S (about 227 km from the pole); all nine regions sit inside
N = 1024


def height_m(u: np.ndarray) -> np.ndarray:
    # uint16 half-meters offset by +20000, relative to the 1737.4 km sphere.
    return u.astype(np.float32) * 0.5 - 10000.0


def bilinear(img: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    h, w = img.shape[:2]
    x = np.mod(x, w)
    y = np.clip(y, 0, h - 1.001)
    x0 = np.floor(x).astype(int)
    y0 = np.floor(y).astype(int)
    x1 = (x0 + 1) % w
    y1 = np.minimum(y0 + 1, h - 1)
    fx = (x - x0)[..., None] if img.ndim == 3 else x - x0
    fy = (y - y0)[..., None] if img.ndim == 3 else y - y0
    a = img[y0, x0] * (1 - fx) + img[y0, x1] * fx
    b = img[y1, x0] * (1 - fx) + img[y1, x1] * fx
    return a * (1 - fy) + b * fy


def polar_grid():
    v = (np.arange(N) + 0.5) / N * 2 - 1  # -1..1
    X, Y = np.meshgrid(v, v)  # Y down
    r = np.hypot(X, Y)
    lon = np.degrees(np.arctan2(X, -Y))  # 0 at top, 90 E right
    lat = -90 + r * R_DEG
    return lat, lon, r


def main(src: Path, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    color = tifffile.imread(src / "lroc_color_poles_4k.tif")[..., :3]
    Image.fromarray(color).save(out / "color_4k.jpg", quality=84, optimize=True, progressive=True)
    Image.fromarray(color).resize((2048, 1024), Image.LANCZOS).save(out / "color_2k.jpg", quality=84, optimize=True, progressive=True)

    g = height_m(tifffile.imread(src / "ldem_4_uint.tif"))
    gmin, gmax = float(g.min()), float(g.max())
    Image.fromarray(np.round((g - gmin) / (gmax - gmin) * 255).astype(np.uint8)).save(out / "globe_height.png", optimize=True)

    lat, lon, r = polar_grid()
    # Equirectangular pixel coordinates (0° lon centered: x = (lon + 180) * ppd).
    hc, wc = color.shape[:2]
    ppd_c = wc / 360.0
    pc = bilinear(color.astype(np.float32), (lon + 180) * ppd_c - 0.5, (90 - lat) * ppd_c - 0.5)
    pc[r > 1] = 0
    Image.fromarray(np.clip(pc, 0, 255).astype(np.uint8)).save(out / "pole_color.jpg", quality=88, optimize=True)

    dem = height_m(tifffile.imread(src / "ldem_16_uint.tif"))
    ppd_h = dem.shape[1] / 360.0
    ph = bilinear(dem, (lon + 180) * ppd_h - 0.5, (90 - lat) * ppd_h - 0.5)
    inside = r <= 1
    hmin, hmax = float(ph[inside].min()), float(ph[inside].max())
    q = np.round((np.clip(ph, hmin, hmax) - hmin) / (hmax - hmin) * 65535).astype(np.uint16)
    rgb = np.zeros((N, N, 3), np.uint8)
    rgb[..., 0] = q >> 8
    rgb[..., 1] = q & 255
    Image.fromarray(rgb).save(out / "pole_height.png", optimize=True)

    # Tangent-space normal map for fine relief detail (same grid). Uses the web's 2.5x relief
    # exaggeration so shading matches the mesh. Pixel size in metres:
    px_m = (R_DEG * np.pi / 180 * 1737400.0) * 2 / N
    hz = ph * 2.5
    gy, gx = np.gradient(hz, px_m)  # rows = +z (south on image = toward +z), cols = +x
    nx, ny, nz = -gx, np.ones_like(gx), -gy
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    # Tangent space for a plane rotated -90° about X: tangent=+x, bitangent=-z, normal=+y
    tn = np.stack([nx / l, -nz / l, ny / l], -1)
    Image.fromarray(np.round((tn * 0.5 + 0.5) * 255).astype(np.uint8)).save(out / "pole_normal.png", optimize=True)

    # Neutral grey albedo. Near the pole the equirectangular colour map smears into radial
    # streaks, so the albedo is blurred lightly and blended toward a constant regolith grey;
    # relief detail comes from the normal map instead.
    from PIL import ImageFilter
    lum = 0.2126 * pc[..., 0] + 0.7152 * pc[..., 1] + 0.0722 * pc[..., 2]
    inside_l = lum[r <= 1]
    lo, hi = np.percentile(inside_l, 2), np.percentile(inside_l, 99)
    a = np.clip((lum - lo) / (hi - lo), 0, 1)
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6)), np.float32) / 255
    g = (0.55 + 0.45 * a) * 200  # base regolith grey, gentle albedo variation
    g[r > 1] = 0
    Image.fromarray(np.stack([g, g * 0.985, g * 0.965], -1).astype(np.uint8)).save(out / "pole_color.jpg", quality=88, optimize=True)

    meta = {
        "source": "NASA SVS CGI Moon Kit (ID 4720): LROC WAC color + LOLA elevation",
        "globe": {"height_min_m": gmin, "height_max_m": gmax, "ppd": 4},
        "pole": {
            "size_px": N,
            "lat_edge_deg": -90 + R_DEG,
            "radius_km": round(R_DEG * np.pi / 180 * 1737.4, 2),
            "height_min_m": hmin,
            "height_max_m": hmax,
            "projection": "azimuthal equidistant about the south pole; 0 deg lon up, 90 E right",
            "dem_ppd": 16,
        },
    }
    (out / "meta.json").write_text(json.dumps(meta, indent=1))
    print(json.dumps(meta, indent=1))


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
