# Validation of the pipeline output (real data, params_ref 319725853747)

All numbers below were computed from the files in `web/public/data/` and the team's independent files (`team/main:web/public/data/`), on 2026-11-15.

## 1. Physical check: maximum Sun elevation
The Sun at a polar site never rises more than about (90 - |lat|) + 1.6° (lunar axial tilt plus the Sun's radius).

| Site | Latitude | Expected | Pipeline |
|---|---|---|---|
| Haworth | -86.35 | 5.25° | 5.23° |
| Mons Mouton Plateau | -84.68 | 6.92° | 6.89° |
| Mons Mouton | -85.41 | 6.19° | 6.17° |
| Nobile Rim 1 | -85.21 | 6.39° | 6.36° |
| Nobile Rim 2 | -84.07 | 7.53° | 7.48° |
| de Gerlache Rim 2 | -88.65 | 2.95° | 2.91° |
| Slater Plain | -87.26 | 4.34° | 4.29° |

## 2. Independent implementation: Sun and Earth angles
Our series (Skyfield, SPICE DE421, `MOON_ME_DE421` frame, exact parallax) against the team's calculator (astronomy-engine, different ephemeris and rotation model), every hour of 2027:

| Site | Sun elevation max | Sun azimuth max | Earth elevation max | Earth azimuth max |
|---|---|---|---|---|
| Haworth | 0.007° | 0.014° | 0.007° | 0.013° |
| Malapert Massif | 0.007° | 0.014° | 0.008° | 0.013° |
| Slater Plain | 0.007° | 0.014° | 0.008° | 0.013° |

The team's calculator was itself compared with NASA JPL Horizons: 600 comparisons, largest difference 0.004° (`docs/validation.md` in the team repo).

## 3. Terrain
- Site heights from our 20 m DEM against the team's 474 m grid: differences 0.4 to 27.1 m over the 9 regions.
- Horizon profiles (mast 2 m), ours against the team's, mean absolute difference per site: Slater Plain 0.32°, Mons Mouton 0.65°, de Gerlache Rim 2 0.94°, Nobile Rim 1 1.20°, Malapert Massif 1.58°, Mons Mouton Plateau 1.66°, Nobile Rim 2 1.72°, Haworth 1.92°, Peak near Cabeus B 2.49°. Correlation at zero azimuth shift: 0.64 to 0.86 at 8 sites, negative at Peak near Cabeus B. **Open question**, see limitations.
- Not done yet: comparison with the LROC illumination map.

## 4. Internal consistency
- A window's `p_survive_14d` and the ghost landers of the same window come from the same draws: alive/total of the ghost sample equals the window probability exactly (checked in the run log for all 9 sites).
- Every output file passes `contracts/validate.py` (0 errors).

## 5. Results snapshot (generic lander, see assumptions)
- Best survival probability over 2027–2030 per site: Malapert Massif 96.4%, Nobile Rim 2 92.3%, Mons Mouton Plateau 84.5%, Haworth 83.9%, Slater Plain 83.1%, Nobile Rim 1 76.6%, Mons Mouton 72.9%, de Gerlache Rim 2 72.4%, Peak near Cabeus B 57.4%.
- Only Malapert Massif reaches 95%: the ten ranked windows are all there (2027-10-08 to 2030-09-05, 95.1% to 96.4%). Earth is in view 98 to 100% of those windows.
- Most windows are poor: the mean over all days is 10 to 23% per site, because a 14-day mission on a 2.5 kWh battery needs sunlight with no night longer than about 42 h.
