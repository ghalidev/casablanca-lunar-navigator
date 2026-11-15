# LASTLIGHT film app (`web/`)

One continuous 3D film on real NASA terrain that you steer: scroll, click a region, or ask the copilot.
It is a **separate package** next to the root app: it does not touch the root `package.json`, `src/` or `contracts/`.

Chapters (one URL scheme, `/?ch=<shot>&site=<id>`):

| Shot | What you see |
|---|---|
| `moon` | The Moon, real LROC colour and LOLA relief |
| `pole` | Dive onto the real south-pole relief; the 9 Artemis III regions as clickable labels |
| `athena` | Where Athena (IM-2) landed, 6 March 2025 |
| `site` | On the ground at a region: Sun and Earth from the data series, time scrubber, panel power |
| `crash` | Hundreds of simulated landers fall on the relief and turn red when their battery dies |
| `verdict` | The top landing windows from `top10.json`, with CSV export |

`/method` is a document page (how it works, limits, NASA notice). Other deep-link options: `?clean` hides all UI (used to capture the video), `?t=<hour of year>` sets the ground time.

## Data honesty

- **Everything is mock data today.** The app reads `contracts/mock/` and shows a "Mock data" banner whenever any loaded file has `"mock": true`. Do not quote a number from it.
- Real files go in `web/public/data/` (`sites.json`, `series/{id}_{year}.json`, `survival/{id}.json`, `top10.json`, as in `contracts/schema.json`). The app prefers `/data` over `/mock`; the banner disappears when no file says `mock: true`.
- It accepts **both shapes of the data contract** (v1 and the team's v2: `ghost_landers_sample` as array or as `{landing_utc, sim_duration_h, landers}`; `top10.criteria` with years or with `from_utc` / `to_utc`). See `src/data/normalize.ts`.
- The 3D terrain and colour come from NASA's CGI Moon Kit (LOLA, LROC) and are **visuals only**, at about 1.9 km/px with relief x2.5. The pole and Athena shots use labelled "overview lighting". Only the ground shot uses Sun and Earth directions from the series file. Assumptions: `docs/film/assumptions.md`. Limits: `docs/film/limitations.md`.
- The AI never produces a result. The copilot only picks whitelisted UI actions (digits are stripped from its sentence). "Explain" rewrites a fact sheet and every number in the text is matched to the sheet, else a fixed template is shown.

## Run it

Needs Node 22 or newer.

```bash
cd web
npm install
npm run dev        # http://localhost:5173 ; predev copies ../contracts/mock to public/mock
npm test           # 30 unit tests (node:test, TypeScript run directly)
npm run lint
npm run build      # typecheck + production build in dist/
```

Copilot and "Explain" need a Groq key, **never committed**: create `web/.env.local` with one line, `GROQ_API_KEY=...`.
Without it the app works; the copilot reports itself offline and "Explain" shows a fixed sentence.
In dev, `vite.config.ts` serves `/api/brief` and `/api/copilot` with the same code as the deployed functions.

## Structure

```
src/mission/    the one 3D scene (Mission.tsx, MissionScene.tsx), terrain from the LOLA tile, generated Web Audio soundscape
src/film/       shots, camera flights, clock, event bus, verdict rows + CSV (pure, unit-tested)
src/copilot/    whitelisted actions (shared with the server), deterministic find_best search over the data
src/ai/         fact sheets and number verification for "Explain"
src/data/       loader (/data then /mock), contract normalizer, stats
api/            Vercel functions;  functions/api/  Cloudflare Pages Functions (same logic in api/_lib/)
scripts/        prepare_moon.py (rebuilds public/moon from the NASA SVS download), sync-mock.mjs
public/moon/    about 5.5 MB of Moon textures, committed on purpose (small)
```

To rebuild the Moon assets: download `lroc_color_poles_4k.tif`, `ldem_16_uint.tif` and `ldem_4_uint.tif` from https://svs.gsfc.nasa.gov/4720 into an empty folder, then `python3 -I scripts/prepare_moon.py <that folder> public/moon` (needs numpy, pillow, tifffile, imagecodecs). The raw files are never committed.

## Deploy

Cloudflare Pages (what we used): `npm run build`, then `wrangler pages deploy dist --project-name <name> --branch main`, secret `GROQ_API_KEY` set in the Cloudflare project.
A copy of this app built from the author's repo: https://lastlight-17r.pages.dev (may be behind this branch).
Vercel also works: Root Directory `web`, env var `GROQ_API_KEY` (`vercel.json` rewrites everything but `/data`, `/mock`, `/assets` to the SPA).

## The video (`../video/`)

30 s Remotion film built from real captures of this app, the recorded ElevenLabs voice (`../assets/audio/voice.mp3`, word timings next to it) and an original synthesized score.
`cd ../video && npm install && npm run render` writes `out/lastlight.mp4` (git-ignored; needs Chrome). Script and cut times: `docs/film/video-script.md`.
The crash shot uses mock landers: re-capture and re-render once real data lands. Capture frames from the dev server with `?clean`; the dev-only `/__capture` route accepts same-origin posts only.

## Known issues

- Mock data everywhere (see above); region pins use the mock `sites.json` positions, not Adam's digitized ones in `public/data/sites.json` at repo level.
- The 3D skyline is not the computed horizon: on mock data, the "Sun hidden" readout and the shadows can disagree.
- Dead CSS from removed pages remains in `src/index.css`.
- Not tested on real phones.

More: `docs/film/` (design, assumptions, data sources, limitations, log, video script, submission draft).
