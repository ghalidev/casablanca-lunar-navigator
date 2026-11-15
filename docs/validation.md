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
  ephemeris. They are limited by **terrain** (flat horizon today) and by the **site position**
  (one point per region, about ±3 km).

## What this does not validate
- Terrain: the horizon is flat until LOLA terrain horizons are added. Validating terrain lighting
  needs a comparison with LROC or LOLA-based illumination maps (not done).
- Site positions (digitized from NASA's map, documented in `docs/assumptions.md`, A7).
