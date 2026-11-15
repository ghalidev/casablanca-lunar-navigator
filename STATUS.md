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
