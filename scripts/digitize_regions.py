"""Digitize the 9 Artemis III candidate region centers from NASA's official map.

Source map: "The 9 candidate landing regions", Credit NASA/GSFC/ASU/JSC/AGDT, Image 1 of
George, Rubio, Lawrence & Curell, "Artemis III Site Selection Update: Downselection from
Thirteen to Nine Candidate Regions", LPSC 2026, NTRS 20250011660.
Copy: docs/figures/nasa-artemis3-9-regions.png (709 x 548 px).

Method: south polar stereographic view, 0 deg longitude up, east-positive to the right
(checked: Malapert box -> 86.0 S, 0 E = Malapert Mountain). Pole = green star centroid.
Scale = map scale bar, 50 km = 89.5 px. Region center = center of the yellow box (pixel
extents measured by thresholding yellow pixels). Stdlib only: python3 scripts/digitize_regions.py
writes public/data/sites.json.
"""

import json
import math
from pathlib import Path

R_KM = 1737.4
KM_PER_PX = 50 / 89.5
POLE_PX = (370.15, 378.44)

# id: (name, x_min, x_max, y_min, y_max) yellow box outer pixel extents
BOXES = {
    "peak-near-cabeus-b": ("Peak near Cabeus B", 31, 68, 234, 272),
    "haworth": ("Haworth", 275, 330, 189, 244),
    "malapert-massif": ("Malapert Massif", 350, 389, 142, 181),
    "mons-mouton-plateau": ("Mons Mouton Plateau", 457, 596, 62, 166),
    "mons-mouton": ("Mons Mouton", 486, 515, 152, 182),
    "nobile-rim-1": ("Nobile Rim 1", 502, 539, 163, 200),
    "nobile-rim-2": ("Nobile Rim 2", 632, 669, 190, 227),
    "de-gerlache-rim-2": ("de Gerlache Rim 2", 266, 303, 318, 356),
    "slater-plain": ("Slater Plain", 477, 514, 448, 486),
}

SOURCE = (
    "Digitized region-box center from NASA's official 9-region map "
    "(NASA/GSFC/ASU/JSC/AGDT; LPSC 2026 abstract, NTRS 20250011660). Approx. +/-3 km."
)


def px_to_latlon(cx: float, cy: float) -> tuple[float, float]:
    dx, dy = cx - POLE_PX[0], POLE_PX[1] - cy
    d_km = math.hypot(dx, dy) * KM_PER_PX
    colat = math.degrees(2 * math.atan(d_km / (2 * R_KM)))  # inverse polar stereographic
    lon = math.degrees(math.atan2(dx, dy))
    return -(90 - colat), lon


def main() -> None:
    sites = []
    for sid, (name, x0, x1, y0, y1) in BOXES.items():
        lat, lon = px_to_latlon((x0 + x1) / 2, (y0 + y1) / 2)
        sites.append({
            "id": sid, "name": name, "lat": round(lat, 2), "lon": round(lon, 2),
            "source": SOURCE, "approximate": True,
        })
    out = Path(__file__).resolve().parent.parent / "public" / "data" / "sites.json"
    out.write_text(json.dumps({"mock": False, "sites": sites}, indent=2) + "\n")
    for s in sites:
        print(f"{s['id']:22s} {s['lat']:8.2f} {s['lon']:8.2f}")


if __name__ == "__main__":
    main()
