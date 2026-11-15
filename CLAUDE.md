# LASTLIGHT — Lunar Landing Site Navigator — Team Casablanca (NASA Space Apps 2026)

## SCOPE DECISION (Ghali, Sat 14 Nov ~21:50) — overrides docs/LASTLIGHT-brief.md
We started late, so we MERGE the two plans:
- KEEP from LASTLIGHT: the name and tagline ("Choose where and when your lander survives the
  lunar south pole"), the Athena story for the pitch, the design system (below), the 9 Artemis III
  regions, the rules "no invented numbers / MOCK DATA banner / no chatbot / no ML",
  docs/assumptions.md, docs/limitations.md, docs/data-sources.md, docs/log.md.
- BUILD: one web app at the repo root (NOT /web). Ephemeris in the browser with astronomy-engine
  (src/lib/ephemeris.ts, already working). Screens: Site view (timeline + metrics), Compare,
  Horizon ring (sky view), best-window finder. Terrain horizons from LOLA if time allows (Adam).
- STRETCH (Sunday only, if everything else is done): simplified survival odds per window.
- DROPPED: Python/Skyfield/Modal pipeline, raymarched lander view.
  Read docs/LASTLIGHT-brief.md for background and the pitch story only.

## UPDATE (Ghali, Sun 15 Nov ~00:15): Yasin's film app and video are merged
- Two apps live in this repo:
  1. ROOT app (`src/`, real computed Sun/Earth data): the planning tool. Owners as listed below.
  2. FILM app (`web/`, separate package, 3D story + crash test + copilot) and VIDEO (`video/`,
     Remotion, 30 s). Owner: Yasin. See web/README.md. It currently runs on MOCK data.
- Never edit `web/` or `video/` unless you are Yasin; never edit root `src/` from the film app.
- Priority for Sunday: real numbers everywhere (JPL Horizons validation, LOLA terrain), then feed
  the film app with real data instead of contracts/mock.
- Competitors (docs/competition.md): LunaNav already has LOLA terrain + Horizons + 3D. Our edge is
  validation, survival under uncertainty and the Athena story: protect it.

## Design system (from LASTLIGHT)
Background #0B0B0C, text #E8E6E1, grey #6B6B6B. Sun #F2A93B, Earth #4C8DF6, both #3FB68B,
alert/death #E5484D (only for that). IBM Plex Sans for text, IBM Plex Mono for every number.
No purple gradients, no glassmorphism, no emojis, no decorative icons. Mission-console look.
Max Sun elevation at a site = (90 - abs(lat)) + ~1.6 deg (e.g. ~6.7 deg at 85°S, ~2 deg at 89.5°S).
Any view showing a Sun higher than that is a bug.

Challenge: let mission planners, educators and the public compare lunar south pole landing
sites and dates, showing Sun and Earth positions relative to the local horizon
(power = sunlight, comms = direct-to-Earth visibility).

Stack: Vite + React + TypeScript, `astronomy-engine` (ephemeris), `recharts` (charts).
Everything runs in the browser. No backend.

## TEAM WORKFLOW — read this first
Three people (Ghali, Yasin, Adam) each have their own copy of this repo (cloned from GitHub)
and their own Claude Code. We stay in sync through GitHub, on branch `main`.

- ONLY edit files your person owns (list below). Need a change elsewhere? Tell your human
  so they can ask the owner. Do not "quickly fix" someone else's file.
- `src/types.ts` is FROZEN. Never change it without the whole team agreeing out loud.
- When your human says "sync": run `git pull --rebase`, then `npx tsc -b`, then
  `git add -A`, `git commit -m "<short summary>"`, `git push`. If the pull has a conflict,
  resolve it keeping BOTH sides' changes, then continue. Also sync after finishing each task.
- Never `git push --force`, `git reset --hard`, or switch branches.
- Never `npm install` a new package without your human confirming the team agreed.
  After a sync that changed package.json, run `npm install`.
- Never delete or reformat files you don't own. Never run project-wide formatters.
- Before saying a task is done, run `npx tsc -b` and fix errors in YOUR files.

## Ownership
- Ghali: `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/App.css`, `src/state/`,
  `src/components/layout/`, `src/components/timeline/`, `src/components/compare/`,
  `src/components/cards/`, `src/lib/mock.ts`, `README.md`
- Yasin: `src/lib/ephemeris.ts`, `src/lib/metrics.ts`, `src/lib/windows.ts`,
  `src/lib/*.test.ts`, `docs/validation.md`
- Adam: `public/data/`, `scripts/` (Python terrain pipeline), `src/components/map/`,
  `src/components/sky/`
- Yasin also owns: `web/` (film app) and `video/` (Remotion video)
- Shared/frozen: `src/types.ts`, `CLAUDE.md`, `package.json`, `contracts/`
- Shared docs (anyone may append): `docs/`
- `public/data/sites.json` may use either the `Site[]` shape from src/types.ts or the LASTLIGHT
  `sites_file` shape (`{ mock, sites: [{ id, name, lat, lon, horizon: { mast_2m: [...] } }] }`);
  the app reads both.

## Conventions
- Angles in degrees. Times are ISO 8601 UTC strings. Durations in hours. Distances in km.
- Longitude EAST-positive (-180..180). Latitude negative = south.
- Moon mean radius 1737.4 km. Sun angular radius ~0.267°. Earth angular radius ~0.95°.
- Azimuth: 0 = local north, 90 = east, clockwise. At the pole, avoid lat = -90 exactly.
- Components are function components with typed props; no default exports for libs.
- Keep it fast: 30 days at 30-minute steps must compute in under ~200 ms.

## Credits / rules (Space Apps)
- Cite every NASA data source (LOLA, LROC, JPL Horizons, Artemis III region list) in README.
- Never use the NASA logo/insignia.
- AI use (Claude Code) is disclosed in the submission.
