# LASTLIGHT web: one continuous film (design)

Date: 2026-11-14. Status: approved in chat. Supersedes the multi-page layout of `design.md` (same folder), section Pages. Palette, fonts and copy rules of `design.md`, and the science rules of the repo `CLAUDE.md` (no invented numbers, mock banner, no ML), still hold. Applies to `web/` only.

## Problem
- Every view exists twice: the Mission scene at `/` (6 chapters) and the tool pages `/sites`, `/sites/:id`, `/plan`, `/crash-test`, each with its own weaker 3D scene (`PoleScene`, `CrashScene`).
- Tool pages read as a template (bordered stat cards, pill buttons, boxed lists). `/crash-test` renders an empty black canvas and the top bar overlaps its title.
- Motion is choppy: the camera `up` vector stayed upside down after the globe shot (lerp between opposite vectors, fixed in this branch), a ~200 ms freeze on the first dive (shader compile + texture upload), exponential-lerp camera with no sense of timing.
- The 30 s film (`video/out/lastlight.mp4`) is not in the site.

## Goal
A judge or a NASA engineer opens one URL and gets something that feels like a film they can steer: one scene, cinematic camera, 60 fps, and an AI agent that flies the scene on request. Every number still comes from data files; mock data keeps its banner.

## Structure: one canvas, seven shots
`/` mounts one persistent `<Canvas>`; it is never remounted between shots.

| # | id | View | Overlay |
|---|---|---|---|
| 1 | `moon` | Globe, north up, slow rotation | Title + one line |
| 2 | `pole` | Dive onto the LOLA relief, 9 regions | Clickable site labels; hover shows Sun % / Earth % |
| 3 | `athena` | Real IM-2 touchdown point, tip-over | Three-line story |
| 4 | `site` | Ground view, data-driven Sun and Earth, time scrubber | Horizon ring, panel power |
| 5 | `crash` | 500 ghost landers on the relief, red when dead | Survival curve |
| 6 | `verdict` | Top windows marked on the relief (from `top10.json`) | Ranked list, CSV export |

- `/sites` → `/?ch=pole`, `/sites/:id` → `/?ch=site&site=:id`, `/plan` → `/?ch=verdict`, `/crash-test` → `/?ch=crash`.
- Deleted: `pages/Sites`, `pages/SitePage`, `pages/Plan`, `pages/CrashTest`, `pages/Home`, `components/three/PoleScene`, `components/three/CrashScene` and their CSS.
- `/method` stays a document page (validation, assumptions, limitations, sources) and carries the NASA notice footer. The notice is also shown in the scene (small, bottom edge).

## Camera and image
- Update 22:30: the opening video was dropped at the user's request. Scrolling now scrubs the camera along the path to the neighbouring shot in real time; released past 30 % it lands there, otherwise it springs back.
- Each shot defines `{pos, look, up, fov}`. A transition builds a CatmullRom curve from the current pose through a lifted mid-point to the target, eased (`easeInOutCubic`) over a fixed duration (1.6–3.2 s by distance). `up` is slerped with quaternions (`turnUp`), never lerped.
- Idle: a slow, small drift on the curve end (no pointer-driven jitter on ground shots).
- Post-processing with `@react-three/postprocessing`: bloom on the Sun only (luminance threshold), ACES tone mapping, film grain, vignette. Letterbox bars (CSS) close slightly during flights.
- Performance: `gl.compileAsync` + `gl.initTexture` at start; shadow map `autoUpdate = false`, refreshed only when the Sun direction changes; adaptive DPR (drei `PerformanceMonitor`), 1–2. Budget: median frame ≤ 16.7 ms and no frame > 50 ms during any transition on an M-series laptop at DPR 2, measured per shot.

## AI agent
- Command bar always available on `/` (`/` or `⌘K`), voice input kept.
- Action set (whitelisted in `copilot/actions.ts`, shared by browser and function):
  `fly {shot, site?}`, `set_time {date}`, `crash {site, date?}`, `find_best {site?, days, from, to, need?}`, `compare {a, b}`, `open_method`.
- The model never states numbers (digits stripped from narration, as today). Actions run in sequence, each waits for the camera to arrive, so the user watches the agent work.

## Design system
`design.md` colours and fonts. No bordered cards: overlays are text on the image over a soft gradient scrim, one thin rule, numbers in mono. At most one overlay group visible at a time; at most two animations at once.

## Deployment: Cloudflare Pages
- `web/functions/api/copilot.ts` and `web/functions/api/brief.ts` wrap `web/api/_lib/*` (already `fetch`-based). `GROQ_API_KEY` is a Pages secret, never committed. `GROQ_MODEL` read from env with a default, no `process` in Workers code.
- SPA fallback via `web/public/_redirects` (`/* /index.html 200`).
- Film served from `web/public/film/lastlight.mp4` (H.264, 1080p, ~12 MB) with a poster frame.
- Deploy: `npm --prefix web run build` then `wrangler pages deploy web/dist`.

## Out of scope
- Real pipeline data (science teammate). Mock banner stays until it lands.
- Re-rendering the film in 4K (the current cut shows mock landers; re-render once real data lands).

## Done when
- No duplicate views; old routes redirect.
- Every transition meets the frame budget; no console errors.
- Agent can fly to each shot, set time, run a crash test, find and show best windows.
- Live on a Cloudflare Pages URL, copilot working there.
