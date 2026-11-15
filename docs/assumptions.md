# Model assumptions

Every modelling choice: value, justification, source. Numbers here must match `pipeline/config.py`.

| # | Assumption | Value | Justification | Source |
|---|---|---|---|---|
| A1 | Lunar reference radius | 1737.4 km | Standard LOLA reference sphere | LOLA PDS docs (to cite) |
| A2 | Solar constant | 1361 W/m² | | TBD |
| A3 | Sun angular radius | ≈ 0.267° (computed from distance) | | |
| A4 | Earth angular radius | ≈ 0.95° (computed from distance) | | |
| A5 | Horizon locally flat across the disk width | — | Disk fraction approximation (brief §5.4) | |
| A6 | Sun/Earth direction computed once per time step, rotated per grid point | parallax error = TBD (measure on 2 points) | Performance (brief §5.3) | |
| A7 | Artemis III region positions | Center of each region box on NASA's official 9-region map, digitized (`scripts/digitize_regions.py`), ~±3 km | NASA publishes no numeric coordinates for the 9 regions (Oct 2024 list). Map read as south polar stereographic, 0° lon up, east to the right; pole = map's "South Pole" star; scale = map's 50 km bar (89.5 px). Check: Malapert box → 86.00°S, 0.2°W (Malapert Mountain, ~86°S 0°E). Each region spans ~15–30 km (Mons Mouton Plateau ~78×58 km), so one point stands for a whole region; all sites marked `approximate: true`. | NASA/GSFC/ASU/JSC/AGDT map in George et al., LPSC 2026, NTRS 20250011660; copy in docs/figures/nasa-artemis3-9-regions.png |
| A8 | Landing dispersion σ | TBD | Motivated by Athena: 250 m (IM) / >400 m (NASA) from target | |
| A9 | Lander panels, battery, load | TBD | | `pipeline/config.py` |
| A10 | Comms OK threshold on `earth_frac` | TBD | | |
| A11 | Best-dates window score | sunlight % + 0.5 x Earth-in-view % - 2 x longest darkness (h); ties broken by energy | Power first (a lander dies in the dark), comms second, long nights penalised. Samples every 2 h, candidate start every 6 h, best 3 non-overlapping windows per site. | `src/lib/windows.ts` |
