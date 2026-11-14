# Data contract

`schema.json` is the single source of truth for every JSON file the pipeline writes into
`web/public/data/`. The front develops against `mock/` until real data lands.

| File | Schema def | Size (mock) |
|---|---|---|
| `sites.json` | `#/$defs/sites_file` | ~70 KB |
| `series/{site_id}_{year}.json` | `#/$defs/series_file` | ~340 KB / site / year |
| `survival/{site_id}.json` | `#/$defs/survival_file` | ~330 KB / site |
| `top10.json` | `#/$defs/top10_file` | ~2 KB |

## Conventions
- Times: UTC, ISO-8601 with `Z`. Series sample `i` is at `t0 + i * step_h` hours.
- Angles in degrees. **Azimuth 0 = local north, clockwise** (90 = east). Elevation is measured from the local horizontal plane (sphere R = 1737.4 km), not from the terrain.
- Longitude east-positive, `[-180, 180)`. Frame: Moon ME.
- `horizon.mast_2m[i]` is the terrain horizon elevation at azimuth `i * 0.5°`.
- `died_at_h: null` = the ghost lander was still alive at `sim_duration_h`.
- Every file has `mock` (bool) and `params_ref` (hash of `pipeline/config.py`, or `"mock"`).
  If any loaded file has `mock: true`, the UI shows the **MOCK DATA** banner.

## Additions to the draft in CLAUDE.md §4
Added so the files can be read without guessing. All in `schema.json`:
- `mock` + `params_ref` on **every** file (not only `sites.json`).
- `sites[].position_source`: `official` | `digitized` | `mock` (brief §1: digitized positions must be flagged).
- `series.n` (array length) and `series.mast_m` (which mast height the fractions use).
- `ghost_landers_sample` is now an object `{landing_utc, sim_duration_h, landers[]}` so we know which window the sample belongs to; optional `yaw_deg` per lander.
- `top10.json` defined: `criteria` (`survive_days`, `p_threshold`, `from_utc`, `to_utc`) + `windows[]` = window fields + `rank` + `site_id`.

## Workflow
```bash
python contracts/make_mock.py                # regenerate mock/ (deterministic, stdlib only)
python contracts/validate.py contracts/mock   # or web/public/data before a "data:" PR
```
Any change to `schema.json` = update `make_mock.py`, regenerate `mock/`, update pipeline + web, same PR.

**Mock numbers are synthetic. Never quote them anywhere** — site positions in the mock are placeholders, not the real region coordinates.
