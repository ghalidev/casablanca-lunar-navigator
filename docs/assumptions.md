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
| A7 | Artemis III region positions | TBD | official or digitized? | TBD |
| A8 | Landing dispersion σ | TBD | Motivated by Athena: 250 m (IM) / >400 m (NASA) from target | |
| A9 | Lander panels, battery, load | TBD | | `pipeline/config.py` |
| A10 | Comms OK threshold on `earth_frac` | TBD | | |
