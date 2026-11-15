# Validation against NASA JPL Horizons

**Result: our Sun and Earth positions match NASA JPL Horizons to within 0.004° in azimuth and
0.001° in elevation** (600 hourly comparisons, 4 sites, 3 dates from 2026 to 2028). For scale, the
solar disc is about 0.53° wide: the largest difference is about 1/140 of the Sun's diameter.

Run on Sun 15 Nov 2026 with `node --experimental-strip-types validation/horizons.mts`. Raw output:
`validation/horizons-results.json`.

## Method
- **Reference:** NASA JPL Horizons API (https://ssd.jpl.nasa.gov/api/horizons.api), observer
  table, `CENTER='coord@301'` (a geodetic site on the Moon, reference sphere 1737.4 km, altitude 0),
  `QUANTITIES='4'` (apparent azimuth and elevation), hourly steps, UT. Horizons used the DE441
  ephemeris.
- **Ours:** `computeTrack()` in `src/lib/ephemeris.ts` (astronomy-engine, IAU lunar rotation
  model, Earth parallax from the site), same sites and times.
- **Sites:** Haworth (86.77°S, 22.67°W), Malapert Massif (86.00°S, 0.17°W), de Gerlache Rim 2
  (88.25°S, 64.18°W), and a test point near the pole (89.45°S, 137.30°W).
- **Dates:** 1 Dec 2026, 15 Jun 2027, 10 Mar 2028; 25 hourly points per day (00:00 to 24:00 UTC).
- **Bodies:** Sun (Horizons 10) and Earth (Horizons 399).
- **Azimuth difference** is measured on the sky (multiplied by cos(elevation)), wrapped to ±180°.

## Results
| Body | Quantity | Points | Max abs. difference | Mean abs. difference |
|---|---|---|---|---|
| Sun | azimuth (on sky) | 300 | 0.0037° | 0.0015° |
| Sun | elevation | 300 | 0.0006° | 0.0004° |
| Earth | azimuth (on sky) | 300 | 0.0030° | 0.0016° |
| Earth | elevation | 300 | 0.0007° | 0.0004° |

Per site, date and body:

| Site | Date | Sun max dAz | Sun max dEl | Earth max dAz | Earth max dEl |
|---|---|---|---|---|---|
| Haworth | 2026-12-01 | 0.0037° | 0.0002° | 0.0030° | 0.0007° |
| Haworth | 2027-06-15 | 0.0002° | 0.0005° | 0.0004° | 0.0002° |
| Haworth | 2028-03-10 | 0.0008° | 0.0006° | 0.0018° | 0.0005° |
| Malapert Massif | 2026-12-01 | 0.0037° | 0.0001° | 0.0030° | 0.0007° |
| Malapert Massif | 2027-06-15 | 0.0002° | 0.0005° | 0.0004° | 0.0002° |
| Malapert Massif | 2028-03-10 | 0.0009° | 0.0006° | 0.0018° | 0.0005° |
| de Gerlache Rim 2 | 2026-12-01 | 0.0037° | 0.0003° | 0.0030° | 0.0007° |
| de Gerlache Rim 2 | 2027-06-15 | 0.0002° | 0.0005° | 0.0004° | 0.0002° |
| de Gerlache Rim 2 | 2028-03-10 | 0.0008° | 0.0006° | 0.0018° | 0.0006° |
| Near pole | 2026-12-01 | 0.0037° | 0.0004° | 0.0030° | 0.0007° |
| Near pole | 2027-06-15 | 0.0002° | 0.0005° | 0.0004° | 0.0002° |
| Near pole | 2028-03-10 | 0.0009° | 0.0006° | 0.0018° | 0.0005° |

## Reading the result
- The differences are almost the same at every site for a given date, so they come from the lunar
  orientation model (IAU rotation model in astronomy-engine vs the high-precision lunar orientation
  Horizons uses), not from the site geometry.
- At these levels the sunlight and Earth-visibility timings shown in the app are not limited by the
  ephemeris. They are limited by **terrain resolution** (474 m LOLA grid) and by the **site position**
  (one point per region, about ±3 km).

## What this does not validate
- Terrain: the LOLA terrain horizons (Adam, `scripts/terrain_horizons.py`) are checked separately,
  against a published illumination study: see "Terrain sunlight vs Bussey et al. 2010" below.
- Site positions (digitized from NASA's map, documented in `docs/assumptions.md`, A7).

# Terrain sunlight vs Bussey et al. 2010

**Result: at the summits, our yearly sunlight matches the published values to within 2 percentage
points at 3 of 6 reference points, and within 9 points at 5 of 6** (mean difference 5.5 points).
The outlier is Malapert M1 (ours 61 %, published 74 %). This checks the whole chain: LOLA terrain
horizon + our Sun ephemeris + the "is the Sun up" rule.

Run on Sun 15 Nov 2026 (Adam):
`python3 -I scripts/validate_illumination.py ldem_64_uint.tif`, then
`node --experimental-strip-types scripts/validate_illumination.mts`.
Raw output: `scripts/validation/bussey2010_results.json`.

## Method
- **Reference:** Bussey, D.B.J., et al. (2010), "Illumination conditions of the south pole of the
  Moon derived using Kaguya topography", *Icarus* 208, 558-564, doi:10.1016/j.icarus.2010.03.028.
  Table 2: mean illumination in 2020 at 6 points (Kaguya laser altimeter topography, 474 m/pixel,
  85°S to the pole, a Sun position every 12 h, computed with NAIF/SPICE).
- **Ours:** horizon from the NASA LOLA 64 px/deg grid (`horizon_for()` in
  `scripts/terrain_horizons.py`, 200 km, curvature included), then `computeTrack()` from
  `src/lib/ephemeris.ts` for all of 2020 at 30-minute steps.
- **Where:** Bussey's points are local summits *of the Kaguya terrain*. In the LOLA grid, those exact
  coordinates fall on a slope 40-210 m below a summit 0.7-1.6 km away. Two terrain models from
  different missions can place the same summit about 1 km apart (both are 474 m grids), so we
  climb uphill from each published point to the nearest LOLA summit and compare there. We also
  report the published coordinates as they are.
- **"Lit":** the paper does not say whether "illuminated" means any part of the Sun's disc or its
  centre. We show both. Mast 0 m (ground level).

## Results (2020, mast 0 m)
| Point (Bussey 2010) | Published coords | Nearest LOLA summit | Published % | Ours, any part of the Sun | Ours, Sun centre | Ours at published coords (any part) |
|---|---|---|---|---|---|---|
| A, Shackleton rim | 89.68°S, 166.0°W | 0.74 km away | 81 | 88 | 84 | 55 |
| B, ridge near Shackleton | 89.44°S, 141.8°W | 1.39 km | 82 | 91 | 88 | 45 |
| C, de Gerlache rim | 88.71°S, 68.7°W | 1.34 km | 85 | 83 | 80 | 56 |
| D, ridge off Shackleton rim | 88.79°S, 124.5°E | 0.76 km | 86 | 85 | 80 | 53 |
| M1, Malapert | 86.04°S, 2.7°E | 1.40 km | 74 | 61 | 58 | 57 |
| M2, Malapert | 86.00°S, 2.9°W | 1.59 km | 74 | 75 | 71 | 38 |

With a 2 m mast (the app's value), each point gains 0 to 4 points (all values are in the JSON file).

## Reading the result
- Near the pole, sunlight depends on being exactly on top of the high ground. Moving about 1 km
  off a summit changes the yearly sunlight by 27-46 points at 5 of 6 points (last column). That is why the app's
  lander points are the highest LOLA point in each NASA region (assumption A11): a point on a
  slope would be badly pessimistic.
- At the summits, 3 of 6 points agree within 2 points and 5 of 6 within 9, with no consistent
  bias (ours is higher at A and B, lower at C, D and M1). That spread is the size you expect from
  two different terrain models at 474 m. It is not a sign of a bug in the geometry or the ephemeris.
- Malapert M1 is 13 points low. The LOLA summit we climbed to may not be the same feature as
  Bussey's M1. We did not tune anything to make it match.
- **What to say:** "Our terrain sunlight agrees with a published Kaguya-based study to within a few
  percentage points on the summits. Treat our sunlight percentages as ±10 points."

## What this does not validate
- Our 9 Artemis regions themselves (Bussey's points are not inside them, except near Malapert).
- Earth visibility behind terrain (same horizon code, but no published reference compared).
- Terrain finer than 474 m (boulders, small craters): the grid cannot see them.
