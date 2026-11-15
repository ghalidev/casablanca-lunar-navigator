# Assumptions

Every modelling choice: value, justification, source. Values here match `pipeline/config.py` (`params_ref` in every data file is the hash of that file).

| # | Parameter | Value | Justification | Source |
|---|---|---|---|---|
| 1 | Lunar reference radius | 1,737.4 km | Reference sphere of the LOLA DEM (heights are above it); also the curvature term of the horizon | LOLA GDR metadata |
| 2 | Azimuth convention | 0° = local north (away from the south pole, along the meridian), clockwise | Shared contract | `contracts/schema.json` |
| 3 | Terrain | 20 m/px DEM within 30 km of each site, 240 m/px (60–90°S) beyond | The 80–90°S raster is too small for a 150 km horizon at 83–84°S; the 240 m raster covers it. Fine pixels where ridges decide the skyline | LOLA `LDEM_80S_20MPP_ADJ`, `LDEM_60S_240MPP_ADJ` (NASA PGDA) |
| 4 | Horizon sampling | 720 azimuths (0.5°), ray marching to 150 km, step max(20 m, 0.4% of distance), exact spherical elevation angle | Far mountains block a Sun at ~1.5° | CLAUDE.md §5.2 |
| 5 | Projection scale | Plane distance = k x ground distance, k = 2/(1+sin|lat|) (1.00 to 1.02) | Polar stereographic DEM | Standard formula |
| 6 | Mast heights | 2 m (series, survival), 10 m (also shipped) | Lander panel height / mast | – |
| 7 | Sun and Earth positions | Skyfield, DE421, `MOON_ME_DE421` frame, hourly UTC, 2027–2030, exact site-to-body vectors (Earth parallax up to ~0.26° included, not neglected) | Checked against an independent implementation (docs/validation-pipeline.md) | NAIF SPICE |
| 8 | Disc radii | Sun 695,700 km, Earth 6,371 km, from the real distance each hour | – | IAU |
| 9 | Visible fraction of a disc | Circular segment above a locally flat horizon, horizon interpolated at the disc centre's azimuth. "In view" = at least half the disc | The horizon is flat across a 0.5° to 1.9° wide disc to a good approximation | Geometry |
| 10 | Site positions | Centre of each Artemis III region box digitized from NASA's 9-region map, about ±3 km | No official numeric coordinates found | `pipeline/regions.json`, digitized by the team (`scripts/digitize_regions.py`, team repo) |
| 11 | Generic lander | 4 vertical panel faces of 0.75 m² each, efficiency 0.28, battery 2,500 Wh (full at landing), constant load 60 W | Order of magnitude of a small commercial lander; not any real vehicle. 2.5 kWh lasts about 42 h of load | Design assumption |
| 12 | Power | Sum over faces of area x efficiency x 1361/r² x max(0, sun·normal) x visible sun fraction, hourly | Vertical panels see a grazing Sun | Geometry |
| 13 | Landing error | 2D Gaussian, σ = 200 m per axis (mean radial miss ≈ 250 m) | Athena landed about 250 m from target by Intuitive Machines' figure, over 400 m by NASA's | CLAUDE.md §1 |
| 14 | Tilt | Local terrain slope over a 40 m baseline (from the 20 m DEM) plus 2° rms of touchdown noise; the lander leans downhill ± 25° | Real slopes decide tipping; the DEM cannot resolve below 20 m | LOLA DEM |
| 15 | Tip-over | A lander above 15° of tilt is lost at touchdown (`died_at_h = 0`) | Landers that tipped: Odysseus (IM-1), Athena (IM-2). 15° is a design assumption, not a measured limit | Design assumption |
| 16 | Death | Battery reaches 0 Wh. No thermal model | See limitations | – |
| 17 | Landing grid | Horizons on a 40 m grid over ±800 m of the target (1,681 points); each draw uses the nearest cell | One horizon per draw would be 1000x slower; 40 m is finer than the 200 m σ | – |
| 18 | Monte Carlo | 1,000 draws per landing day, one window per day from 2027-01-01 to 2030-12-17, counter-based RNG so every number is reproducible | A window's probability and its ghost landers come from the same draws | `pipeline/survival.py` |
| 19 | Survival criterion | 14 days, p ≥ 0.95 | Headline result | CLAUDE.md §1 |
| 20 | Slip tolerance | Number of consecutive following days (max 30) whose p also stays ≥ 0.95 | Defined from the same daily series | – |
| 21 | Top 10 | Best windows over all sites, at least 29 days apart for one site | Neighbouring days are near-duplicates | – |
| 22 | Communication | Share of the 14 days with at least half of the Earth's disc above the horizon at the landing point | Direct-to-Earth line of sight | – |

## Planner: "Try your own lander" (browser, web/src/data/lander.ts)

| Assumption | Value | Why |
|---|---|---|
| Same energy model as the pipeline | power = area × efficiency × irradiance_wm2 × Σ max(0, cos(sun_az − face_az)), hourly, battery starts full and is capped | irradiance_wm2 in the series is flux × cos(sun elevation) × visible disc fraction, the pipeline's vertical-panel term (pipeline/survival.py) |
| Lander upright on the target point, no landing error | — | the 1,000-draw Monte Carlo needs the 1,681-point terrain grid, not shipped to the browser |
| Heading unknown | worst of 72 headings (every 5°) shown | conservative |
| Thermal model (optional, off for the reference lander) | one node, 10-min steps; heat in = load + 0.1 m² × irradiance (absorptivity × sunlit box area); heat out = 0.85 × σ × radiator area × T⁴ to a cold sky; heat capacity 50 kJ/K; starts at 20 °C; thermostat heater ≤ 300 W holds the chosen minimum (default −20 °C, radiator 0.5 m²) and draws from the battery | illustrative of a small lander's warm box (white-paint radiator ε≈0.85; ~60 kg of aluminium and electronics); not a vehicle design. Terrain IR and ground conduction ignored (cold-biased at night) |
| "Sun-tracking" option | one vertical panel always facing the Sun's azimuth | upper bound for vertical panels |
