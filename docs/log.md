# Session log

Each session ends with 3 lines: done / in progress / blocked.

## 2026-11-14 — bootstrap (Claude Code, cloud)
- **Done**: CLAUDE.md, repo layout, `contracts/schema.json` (4 file types), deterministic mock generator + validator, `contracts/mock/` (9 sites, series 2027, survival 2027–2030, top10), docs skeletons.
- **In progress**: nothing.
- **Blocked**: DEM/SPICE downloads not started (pipeline owner); Artemis III region coordinates still to be sourced.

## 2026-11-14 — Adam: real site positions
- **Done**: `public/data/sites.json` (`mock: false`) with the 9 Artemis III regions digitized from NASA's official map (`scripts/digitize_regions.py`); A7 + sources + limitation documented.
- **In progress**: SouthPoleMap (src/components/map/).
- **Blocked**: nothing.

## 2026-11-14 — Adam: map + horizon ring
- **Done**: `src/components/map/SouthPoleMap.tsx` (mounted by Ghali), `src/components/sky/SkyPlot.tsx` (horizon ring; checked on Mons Mouton Jan 2027: Sun max 5.16° < 6.2° limit, Earth near az 329°, 30 days/30 min in 64 ms).
- **In progress**: nothing; SkyPlot waits for Ghali to mount it on the Site tab.
- **Blocked**: terrain horizons (Task 4, LOLA) not started — tomorrow.

## 2026-11-15 — Adam: LOLA terrain horizons
- **Done**: `scripts/terrain_horizons.py` → `horizon` (360 az), `heightM`, lander point = highest LOLA point in NASA's region box (A11, A12). 2027 check: Sun max stays under the (90-|lat|)+1.6 limit at all 9 sites; Malapert Earth 95 %, de Gerlache Rim 2 Sun 85 %.
- **Done (later)**: rerun on the 64 px/deg grid (474 m): 2027 Sun % 48–75, Earth % 41–95; values moved up to 15 points vs 16 px/deg (resolution sensitivity, see limitations).
- **In progress**: nothing.
- **Blocked**: nothing.
