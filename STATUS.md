# STATUS (end of Day 1, Sun 15 Nov ~00:45)

Read this first tomorrow, then `git pull`.

## Works (on `main`)
- Planning app (`src/`): south pole map with the 9 Artemis III regions (real positions, ±3 km),
  dates, custom point, timeline with Sun/Earth bands, 6 metrics, sky view with Play, Compare,
  Best dates finder, Planner/Explore modes, CSV export, shareable links. Builds, works on phone.
- Sun/Earth calculator (`src/lib/ephemeris.ts`, Yasin): ~0.1 s for 30 days.
- `src/lib/metrics.ts` and `src/lib/windows.ts`: written from Ghali's session tonight because Yasin
  was on the film app. Yasin: review them, they are yours now.
- Film app (`web/`) and video (`video/`), Yasin: merged, run on MOCK data.
- Docs: README, pitch (`docs/pitch.md`), slides outline (`docs/slides.md`), honest submission
  texts (`docs/submission.md`), assumptions, limitations, data sources.

## Not done
| What | Who | Why it matters |
|---|---|---|
| ~~JPL Horizons validation~~ done: max 0.004° over 600 comparisons (docs/validation.md) | | |
| LOLA terrain horizons → `horizon` in `public/data/sites.json` | Adam | Flat horizon = "FLAT HORIZON" banner; LunaNav (competitor) already has terrain |
| Film app fed with real data instead of `contracts/mock` | Yasin | Film shows "Mock data"; can't quote its numbers |
| ~~Vercel link in README + submission~~ done: https://lunarnavigator-chi.vercel.app | Ghali | |
| Video: render with real captures / numbers | Yasin + Ghali | Demo link for the submission |
| ~~Slides~~ done: "LASTLIGHT pitch deck" (Claude artifact, owner Ghali, share it from its Share menu) | | |
| ~~Phone polish~~ done: chart first on phones, "Change site or dates" button | | |
| Submit on the Space Apps site | Ghali | Check the exact deadline on the event page |

## Tomorrow, first hour
- **Ghali:** rehearse the pitch twice with docs/rehearsal.md; share the deck with Yasin and Adam.
- **Yasin:** real data into the film app, then the video with real captures.
- **Adam:** LOLA terrain for the 9 sites (time-box: stop after 2 h if blocked, keep the flat horizon).

Feature freeze at hour 2:30. Submit at least 1 hour before the deadline.

## Update Sun 15 Nov ~02:30: apps merged
- `web/` (Yasin's 3D film) is now the main app and runs on REAL data: `cd web && node --experimental-strip-types scripts/gen-real-data.mts`
  regenerates `web/public/data/` from our validated calculator (9 regions, hourly 2027, ranked 6- and 14-day windows).
- New in the film: "On the ground" shows 14-day stripe + 5 metrics + hourly CSV; new "Compare" chapter (up to 4 regions, pins or chips);
  "Best landing windows" = real ranking with CSV. Crash test removed (no landing simulation). Method page and footer rewritten honestly.
- Fixed: black 3D view when two overview chapters sit next to each other (zero-length camera flight → NaN).
- Deploy: in Vercel, set the project's Root Directory to `web` (main link), and add a second project at the repo root for the classic app.
- Not verified on a real GPU: open http://localhost:5191 (or the Vercel preview) and scroll through all chapters once.
