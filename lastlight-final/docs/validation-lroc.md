# Validation against real photographs: LROC illumination map

**Reproduce:** `python3 pipeline/validate_lroc.py` (downloads the LROC GeoTIFF and the SPICE kernels; ~1 min). Output: `docs/validation-lroc.json`.

**Reference.** LROC WAC Time-Weighted South Pole Illumination Map (`WAC_POLE_ILL_TWI_SOUTH_100M`, Speyerer & Robinson 2013): share of 3,807 Wide-Angle Camera images, 15 Feb 2010 to 5 Feb 2011, in which each 100 m pixel of 88–90°S is sunlit. Georeferencing checked on Shackleton crater: floor 0.4 %, rim 89 %.

**Ours.** Every hour of the same period (8,544 hours), the Sun from NAIF SPICE (Skyfield, DE421) against the skyline shipped in `web/public/data/sites.json` (2 m mast), counting an hour as lit when any part of the solar disc clears the skyline.

**Coverage.** The map covers 88–90°S: of the nine Artemis III regions only **de Gerlache Rim 2** (88.65°S) is inside it.

## Result (de Gerlache Rim 2)

| | Sunlit share of the year |
|---|---|
| LROC photos, at our point | **87.1 %** |
| LROC photos, within ±3 km (our position uncertainty), 2,829 pixels | median 84.3 % (quartiles 78.4–91.0 %, range 32.5–100 %) |
| **Ours, shipped skyline (20 m DEM to 30 km + 240 m DEM to 150 km)** | **61.3 %** (half disc or more: 59.0 %) |
| Ours, 240 m DEM only (diagnostic) | 67.7 % |
| Flat horizon at 0° (diagnostic) | 57.8 % |

**Reading.** At this region our model gives **less sunlight than the photographs, by about 26 points**. The near terrain (20 m DEM) accounts for about 6 points of that gap (240 m-only skyline: 68 %). The rest is not explained yet; candidates: (1) our point is the highest ground of a hand-digitized box (±3 km) and the photographs show strong variation inside that circle (32–100 %); (2) the LOLA heights used for the observer versus the 30 m DEM LROC used to map-project its images; (3) LROC counts a pixel lit when it passes a brightness threshold, which partial or scattered light can pass.

**What it means for the results.** On this check our skyline is *pessimistic* about sunlight, so if anything it under-states power at this region. It is one region, so it does not validate or invalidate the other eight. We report it as found.

Related checks by the team: Sun and Earth vs NASA JPL Horizons (`docs/validation.md`, 0.004°), terrain sunlight vs Bussey et al. 2010 published points (`scripts/validate_illumination.py`).
