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
| JPL Horizons validation → `docs/validation.md` | Yasin | Our proof for the judges; the pitch and submission have a [TODO] for it |
| LOLA terrain horizons → `horizon` in `public/data/sites.json` | Adam | Flat horizon = "FLAT HORIZON" banner; LunaNav (competitor) already has terrain |
| Film app fed with real data instead of `contracts/mock` | Yasin | Film shows "Mock data"; can't quote its numbers |
| Vercel link in README + submission | Ghali | Needed for the submission |
| Video: render with real captures / numbers | Yasin + Ghali | Demo link for the submission |
| Slides from `docs/slides.md` | Ghali | Alternative demo format |
| Phone polish: map and site list push the chart far down | Ghali | First impression on mobile |
| Submit on the Space Apps site | Ghali | Check the exact deadline on the event page |

## Tomorrow, first hour
- **Ghali:** add the Vercel link, phone polish, then slides; rehearse the pitch.
- **Yasin:** JPL Horizons validation FIRST (1 h max), then real data into the film app.
- **Adam:** LOLA terrain for the 9 sites (time-box: stop after 2 h if blocked, keep the flat horizon).

Feature freeze at hour 2:30. Submit at least 1 hour before the deadline.
