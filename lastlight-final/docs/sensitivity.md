# Sensitivity of the results to the generic-lander assumptions

Best 14-day survival probability over all landing days 2027-2030, per site, when one assumption changes at a time (1,000 draws per day, same random draws). Reproduce with `modal run pipeline/app.py::sensitivity`. Raw numbers: `docs/sensitivity.json`.

| Variant | Cabeus B | Haworth | Malapert | Mouton Plat. | Mons Mouton | Nobile 1 | Nobile 2 | de Gerlache 2 | Slater | First |
|---|---|---|---|---|---|---|---|---|---|---|
| baseline | 57% | 84% | 96% | 84% | 73% | 77% | 92% | 72% | 83% | Malapert |
| battery 1500 Wh | 52% | 75% | 93% | 80% | 66% | 67% | 91% | 68% | 80% | Malapert |
| battery 4000 Wh | 62% | 90% | 98% | 90% | 86% | 88% | 92% | 77% | 89% | Malapert |
| load 40 W | 62% | 90% | 98% | 90% | 84% | 86% | 92% | 76% | 88% | Malapert |
| load 90 W | 52% | 76% | 94% | 80% | 67% | 68% | 91% | 69% | 81% | Malapert |
| landing sigma 100 m | 64% | 97% | 99% | 97% | 90% | 96% | 98% | 92% | 96% | Malapert |
| landing sigma 400 m | 53% | 59% | 82% | 65% | 53% | 60% | 70% | 48% | 66% | Malapert |
| tilt limit 10 deg | 43% | 79% | 93% | 81% | 66% | 73% | 48% | 58% | 80% | Malapert |
| tilt limit 20 deg | 58% | 84% | 97% | 84% | 76% | 77% | 99% | 75% | 83% | Nobile 2 |

**Reading.** Malapert Massif ranks first in the baseline and in 7 of 8 changed variants. The exception is a lander that tolerates 20° of tilt: Nobile Rim 2, a steep rim (median slope 12.6° at the landing grid), then comes first. Absolute percentages move a lot (a 400 m landing error or a 10° tilt limit costs 10 to 45 points); the order of the sites moves much less. This is why the site compares rankings, not single numbers.

**Not tested yet:** panel layout, thermal behaviour, the 29-day spacing of the top 10, the position of each region inside its box (about 3 km).
