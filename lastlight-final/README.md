# LASTLIGHT

**Choose where and when your lander survives the lunar south pole.**

NASA Space Apps Challenge 2026 · Challenge: *Lunar Landing Site Navigator* · Team **Casablanca, We Have A Solution** (CWS): Adam, Ghali and Yassine, Casablanca.

- **Live app:** https://lastlight.apospace.com (no login, laptop and phone)
- **30 s demo:** https://www.youtube.com/watch?v=ykuUuBfE5Ec (AI-generated voice, English subtitles)
- **Planner for mission teams:** https://lastlight.apospace.com/explore
- **Method, validation, limits:** https://lastlight.apospace.com/method
- **30 s video:** see the project page (link in `docs/submission.md`)

---

## The problem

Water ice is why every agency is heading to the lunar south pole: in 2009 NASA's LCROSS struck Cabeus crater, near the pole, and found water in the plume. The same geometry that keeps ice in craters that never see the Sun makes power brutal for a lander: the Sun only skims the horizon, so a ridge kilometres away can switch a lander off for days.

In March 2025 Intuitive Machines' Athena landed at Mons Mouton, one of NASA's nine Artemis III candidate regions, on its side in a shadowed crater, and its mission ended in less than 13 hours instead of about 10 days. Of the first four CLPS landing attempts (to March 2025), two ended with the lander on its side.

LASTLIGHT answers the question every polar mission now has to ask: **if we aim here, on this day, what is the chance the lander is still alive in 14 days?**

## What it does

| | |
|---|---|
| **Story** (`/`) | One continuous 3D film on real NASA terrain: the Moon, Athena's site, the nine Artemis III regions lit by their survival chance for the chosen day, a crash test of 1,000 landings, and the view from the ground with the Sun and Earth moving over the computed skyline. One landing day drives everything on screen. |
| **Planner** (`/explore`) | Three steps anyone can follow: pick a region (all nine, ranked by their best day), pick a day on a 2027–2030 survival calendar, read the verdict: how many of 1,000 simulated landers are still powered after 14 days, Sun and Earth in view, longest night, launch-slip tolerance, the skyline with the Sun and Earth moving over it, and the same day at the other eight regions. CSV of every day, shareable link. **Try your own lander**: enter your battery, load, night-time heater, panel count, size and efficiency, and the same hourly energy model re-runs the 14 days at the region on that day (upright on the target, worst of 72 headings). Loads about 40 KB of data before the first choice (`web/public/data/planner.json`, a packed copy of the survival files built by `web/scripts/build-planner.mjs`). |
| **Copilot** | A glass command bar on every shot. Plain English goes to a language model that can only trigger whitelisted actions and never writes a number. Or use LASTLIGHT's command language, which runs locally with no AI: `/tp malapert 2027-10-08`, `/crash haworth`, `/stats nobile-rim-2`, `/date +7`, `/compare haworth malapert`, `/best`, `/planner`, chained with `;`. Type `/help`. |

## Challenge requirement → feature

| The challenge asks for | LASTLIGHT |
|---|---|
| Compare candidate landing sites at the south pole | Nine Artemis III regions on real LOLA relief, each with its 14-day survival chance for the chosen day; any two side by side |
| Compare landing dates | Landing day always on screen; year-long survival track per region; ranking of every landing day 2027–2030 |
| Visualize the Sun and Earth relative to the local horizon | Computed 360° skyline with the Sun's and Earth's tracks, hour by hour, in 2D and in a live 3D view from the site |
| Evaluate solar power | Visible Sun-disc fraction and irradiance on vertical panels every hour; battery followed for 14 days per simulated landing |
| Evaluate direct-to-Earth communication | Earth in view (at least half its disc above the skyline) every hour; longest radio silence |
| Useful to mission planners | Survival probability, launch-slip tolerance, sensitivity to the lander, CSV, shareable URLs |
| Useful to educators and the public | A guided 3D film, one short sentence per screen, a copilot that answers in plain English |
| Beyond the brief | ~13 million simulated landings under landing error and terrain tilt; every number traceable to a pipeline file |

## How it works (no machine learning: geometry and counting)

1. **Skyline.** 720 directions per point (every 0.5°), rays to 150 km over the LOLA 20 m/pixel DEM within 30 km and the 240 m/pixel DEM beyond, with the Moon's curvature. Also a grid of 1,681 points (every 40 m, ±800 m) around each target for the crash test. Numba, on Modal.
2. **Sun and Earth.** Skyfield with NAIF SPICE (DE421, `MOON_ME_DE421`), every hour 2027–2030, exact site-to-body vectors (Earth parallax up to ~0.26° included). Visible disc fraction above the skyline, hour by hour.
3. **Survival.** Generic lander (4 vertical panels of 0.75 m² at 28 %, 2.5 kWh battery, 60 W load). Each simulated landing draws a landing error (200 m per axis, matching Athena's published 250 m miss), a tilt from the real slope plus 2° of noise (tips over above 15°), and a heading; then its battery is followed hour by hour for 14 days with the real Sun and the skyline at that exact spot. 1,000 landings per day, every day 2027–2030, 9 regions. Every random draw is a pure function of (site, day, landing), so the browser replays the exact landers the pipeline simulated.
4. **Launch slip.** For each day, how many following days stay at or above 95 %.

All parameters: `pipeline/config.py`. Every assumption with its source: `docs/assumptions.md`.

## Results (from `web/public/data/`, params_ref `319725853747`)

- Best 14-day survival per region, 2027–2030: Malapert Massif 96.4 %, Nobile Rim 2 92.3 %, Mons Mouton Plateau 84.5 %, Haworth 83.9 %, Slater Plain 83.1 %, Nobile Rim 1 76.6 %, Mons Mouton 72.9 %, de Gerlache Rim 2 72.4 %, Peak near Cabeus B 57.4 %.
- Only Malapert Massif reaches 95 % (12 landing days out of 1,447), with the Earth in view 98–100 % of those windows.
- Windows are narrow: at the best day (15 Oct 2029, 96.4 %), landing one day later gives 91.6 %, three days later 72.6 %.
- The ranking is robust to the lander: Malapert stays first in 7 of 8 variants (`docs/sensitivity.md`).

## What the survival percentage means (and does not)

- **96.4 %** = 964 of 1,000 simulated landings of the *generic* lander at Malapert Massif on 15 Oct 2029 whose battery never ran empty in 14 days. Sampling uncertainty: 95 % interval 95.1 % to 97.4 % (Wilson, n = 1,000).
- It is a **power-survival index for comparing places and days**, not the probability that a real mission succeeds: no thermal model, a generic lander, a simple 15° tip-over limit, region positions digitized by hand (±3 km). Model uncertainty is larger than the sampling uncertainty: changing the lander moves absolute values by 10 to 45 points, while Malapert stays first in 7 of 8 variants (`docs/sensitivity.md`).
- Partial answers in the app: your own lander numbers, and a night-time heater draw as a first-order thermal proxy (Planner, `web/src/data/lander.ts`, tests in `lander.test.ts`). With the reference lander, that single upright landing agrees with the Monte Carlo majority verdict on 89.5 % of 1,863 sampled region-days; the gap is landing error.

## Verify the numbers yourself

```bash
python3 pipeline/verify_published.py   # 1 s, no download: 9 regions, 13,023,000 landings, 964/1000 at Malapert 2029-10-15,
                                       # and 2027 survivors recounted from the shipped per-landing death hours (3,285 region-days)
python3 -m pytest pipeline/test_core.py   # horizon and disc-fraction physics
cd web && npm test                        # 45 tests, including ghost replay = published % for every 2027 day
```
Full recomputation from NASA data (needs a Modal account): `modal run pipeline/app.py::fetch_all`, then `modal run pipeline/app.py` (horizons, Sun/Earth, survival 2027–2030), `::ghosts`, `::sensitivity`. Every output file carries `params_ref 319725853747`, the hash of `pipeline/config.py`.

**About the development log.** The repository root holds the team's first prototype (browser-only, astronomy-engine). Its `STATUS.md` entry of 15 Nov 02:30 ("Crash test removed (no landing simulation)") and its data script describe *that* prototype. The landing simulation is this folder's `pipeline/` (Python, numba, run on Modal), and its outputs are the files in `web/public/data/survival/` and `web/public/data/ghosts/` that the site loads.

## Validation and honest limits

- Our Sun/Earth angles vs an independent implementation (astronomy-engine): ≤ 0.014° over every hour of 2027; that implementation vs NASA JPL Horizons: ≤ 0.004° (600 comparisons). `docs/validation-pipeline.md`
- Sun elevation never exceeds the physical limit at each latitude (within 0.05°).
- Crash-test survivors equal the published probability for every site and day of 2027 (automated test).
- **Not modelled / not yet proven:** no thermal model (survival is likely overestimated; night-heater proxy only); generic lander (own numbers in the Planner); the pixel-by-pixel comparison with the LROC illumination map is not finished; region positions digitized from NASA's map (±3 km). `docs/limitations.md`

## Run it

```bash
cd web && npm install && npm run dev      # http://localhost:5173
npm test                                  # 45 unit tests (camera continuity, ghost replay, copilot whitelist, data)
npm run build
python3 contracts/validate.py web/public/data   # every shipped file against contracts/schema.json
```
Pipeline (Python 3.11): `pipeline/` (`modal run pipeline/app.py::series_all`, tests in `pipeline/test_core.py`).

## Repository

- `pipeline/` science: horizons, ephemerides, survival Monte Carlo (`survival.py`), parameters (`config.py`), `verify_published.py`
- `web/` React + TypeScript + three.js app (Cloudflare Pages)
- `contracts/` JSON Schema of every data file + mock data
- `video/` Remotion source of the 30 s film
- `docs/` submission text, data sources, assumptions, limitations, validation

## Team

Casablanca, We Have A Solution (CWS), three people, roles as in the git history:
- **Adam**: digitized the nine Artemis III regions from NASA's map, south-polar map, horizon ring sky chart, LOLA terrain horizons for the team calculator.
- **Ghali**: the team's browser calculator, JPL Horizons validation (600 comparisons, 0.004°), best-dates finder, pitch and submission texts.
- **Yassine**: the survival pipeline, the 3D film app and Planner, the 30 s video.

## Use of AI

Code co-written by the team with Claude Code (Anthropic); this acknowledgement is the code's SI disclosure, as required by the 2026 Project Submission Guide. The in-app copilot uses an open model on Groq, restricted to whitelisted actions; digits are stripped from its replies. The video voice-over is AI-generated (ElevenLabs). **No scientific result is produced by AI.**

## Data and credits

NASA LRO LOLA (PGDA), NAIF SPICE, NASA SVS CGI Moon Kit (display only), LROC (Athena site, illumination map), NASA Artemis III regions. Full list with licences: `docs/data-sources.md`.

---
NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites. For non-U.S. Government websites, participants must comply with any data use parameters of that specific website.
