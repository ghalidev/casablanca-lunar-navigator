# Lunar Landing Site Navigator — Team Casablanca (NASA Space Apps 2026)

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
- Shared/frozen: `src/types.ts`, `CLAUDE.md`, `package.json`

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
