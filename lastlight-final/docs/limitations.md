# Known limitations

## What "96.4 % survival" means, and what it does not

- **It is an electrical-survival index, not the probability that a real mission succeeds.** It is the share of 1,000 simulated landings of a *generic* solar-powered lander (pipeline/config.py) whose battery never runs empty during 14 days, given the stated landing error, terrain tilt, tip-over limit and the computed Sun and skyline. Thermal failure, avionics faults, dust, communications hardware and the real design of any vehicle are outside it.
- **Use it to compare places and days, not as an absolute promise.** The sensitivity study (docs/sensitivity.md) moves absolute values by 10 to 45 points when the lander changes, but Malapert Massif stays first in 7 of 8 variants.
- **Sampling uncertainty** of a 1,000-draw estimate: 964/1000 = 96.4 %, 95 % Wilson interval 95.1 % to 97.4 % (`python3 pipeline/verify_published.py`). Model uncertainty (lander, thermal, terrain) is larger than this.
- **Reproducible.** Every percentage is in web/public/data/survival/*.json (params_ref 319725853747), produced by pipeline/app.py with pipeline/survival.py; the 2027 per-landing death hours are shipped (web/public/data/ghosts/) and recounted by the verification script and by a unit test.

## Partial answers we ship for the two biggest gaps

- **Thermal (one-node model, Planner only).** "Keep electronics warm" in the Planner's "Try your own lander" panel runs a one-node heat balance of the warm electronics box every 10 minutes: heat in = the electrical load + sunlight absorbed by the box (same Sun and skyline as the panels), heat out = radiation to space from a radiator (εσAT⁴); a thermostat heater holds the box at the chosen minimum and draws from the battery (web/src/data/lander.ts, tests in lander.test.ts; constants in docs/assumptions.md). Still not modelled: battery capacity fade in the cold, conduction to the ground, terrain infrared, part-by-part temperature limits. The 1,000-lander percentages do not include it.
- **Lander-specific numbers.** The same panel lets anyone enter their own battery, load, panel count, panel size and cell efficiency and re-runs the 14 days hour by hour, upright on the target, keeping the worst of 72 headings. With the reference lander, its verdict agrees with the 1,000-draw Monte Carlo majority on 89.5 % of 1,863 sampled region-days (the gap is landing error, which this panel leaves out). The 1,000-lander percentages always use the reference lander.

## List

Each entry: what, why it matters, expected direction of the error.

- **No thermal model.** Death = battery at 0 only (the 60 W load lumps heaters and avionics). Not modelled: surface and component temperatures, heat loss to space, battery capacity loss in the cold, component temperature limits. Real landers (Athena) also suffer from cold. Survival is likely *overestimated*. Partial answer: the one-node thermal model in the Planner (see above).
- **Generic lander.** Four vertical panels, 2.5 kWh, 60 W: an order of magnitude, not a real vehicle. Rankings between sites are more trustworthy than absolute percentages (sensitivity study: docs/sensitivity.md; own numbers: the Planner's "Try your own lander").
- **Tip-over limit of 15°** is a simplified threshold (a real lander's stability depends on its legs, centre of mass and touchdown speed); docs/sensitivity.md shows 10° and 20°. Slopes come from a 20 m DEM and cannot show rocks and small craters under 20 m, so tilt at the lander scale is uncertain in both directions.
- **Region positions** are digitized by hand from NASA's official map of the nine regions, good to about 3 km (no numeric coordinates are published). A different point inside a region can change the skyline. Inside each region the target is the highest ground in the digitized box, and the 1,000 landings spread over ±800 m around it.
- **Horizon agreement.** Our 20 m / 240 m skyline and the 474 m grid skyline of the team's terrain script agree in shape (correlation 0.64 to 0.87 at 8 of 9 sites, no azimuth offset) but differ by 0.3° to 2.5° on average. Not yet explained. Ours is the one shipped.
- **Illumination vs LROC photos: one region, and it disagrees.** The LROC map covers 88–90°S, so only de Gerlache Rim 2 can be checked: photos 87 % lit at our point (84 % median within ±3 km), our model 61 % (docs/validation-lroc.md). Our skyline is darker than the photos there (pessimistic on power). The other eight regions are outside the map.
- **Hourly steps.** A short sunrise or sunset inside one hour is averaged. Days with a long night are not affected.
- **Ground view covers 2027 only.** Survival windows cover 2027–2030.
- **Terrain far field is 240 m/px** beyond 30 km: a narrow far ridge could be missed between samples (error is small in angle).
- The mock data in `contracts/mock/` is synthetic and must never be quoted. The site only falls back to it if the real files are missing.
