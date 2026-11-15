# Submission texts (NASA Space Apps 2026): root app, honest version

Paste into the project page. Every claim below is true for what is on `main` tonight (Sun 15 Nov,
~00:45). Lines marked **[IF SHIPPED]** go in only if that part is live before submitting; lines
marked **[TODO]** must be filled. Yasin's film-app draft is in `docs/film/submission-draft.md`; it
describes features that do not exist yet (LOLA 20 m pipeline, SPICE, Monte Carlo, LROC validation):
do not paste from it unless those parts ship.

---

## Project Name
LASTLIGHT

## High-Level Summary
At the lunar south pole the Sun never climbs high: it circles just above the horizon, and a single
ridge can leave a lander in the dark for days. In March 2025 the Athena lander touched down near the
pole and its mission ended less than 13 hours later because its solar panels could not recharge.
LASTLIGHT lets mission planners, teachers and the public compare NASA's nine Artemis III candidate
regions and any landing dates in seconds. It computes, in the browser, where the Sun and Earth are
relative to each site's horizon, shows when the site has power, a direct radio link to Earth, both
or neither, summarises it in six metrics, compares sites side by side and ranks the best landing
windows for a mission of any length. A Planner mode shows the numbers; an Explore mode explains them
in plain language.

## Link to Demo
[TODO: video link (YouTube unlisted or Drive), or the slides]

## Link to Final Project
https://lunarnavigator-chi.vercel.app · Source: https://github.com/ghalidev/casablanca-lunar-navigator

## Detailed Description

**What it does**
- South polar map with the 9 Artemis III candidate regions (Oct 2024 list), plus any custom point.
- Timeline of Sun and Earth elevation over any date range, with the horizon and coloured bands:
  Sun + Earth (power and comms), Sun only, Earth only, dark and silent.
- Six metrics: sunlight %, longest darkness (what the battery must survive), Earth in view %,
  longest comms gap, Sun + Earth %, energy per kW of vertical solar panel.
- Sky view ("horizon ring"): the sky seen from the site, with the Sun and Earth paths and a
  time slider / Play animation linked to the timeline.
- Compare 2–4 sites, best value per row highlighted.
- Best dates: for a mission of N days (default 6, Artemis III's planned surface stay), every
  landing time (every 6 h) at every site is scored and the top 10 non-overlapping windows are listed.
- CSV export of the time series and comparisons; shareable links that reopen the same view.
- Planner and Explore modes (numbers vs plain language).
- **[IF SHIPPED]** 3D story app: flight from the Moon to the pole, Athena's landing area, crash test.

**How it works**
1. For each time step, the Moon's orientation comes from the IAU lunar rotation model and the Sun
   and Earth positions from the astronomy-engine library.
2. Both are rotated into the site's local east/north/up frame, including the Earth parallax from
   the site (about 0.26°), giving azimuth and elevation.
3. The fraction of the solar disc (radius 0.267°) above the local horizon gives sunlight; Earth is
   counted visible 0.5° above the horizon.
4. Metrics and window scores are computed from that series. 30 days at 30-minute steps take ~0.1 s;
   a 6-month search over 9 sites takes under a second.
5. **[IF SHIPPED]** Terrain horizons from NASA LOLA elevation data replace the flat horizon.

**Validation**
We compared our Sun and Earth azimuth and elevation with NASA JPL Horizons (DE441) for 4 south-pole
sites (Haworth, Malapert Massif, de Gerlache Rim 2 and a point at 89.45°S) on 3 dates between 2026
and 2028, hourly: 600 comparisons in total. The largest difference was 0.004° in azimuth and 0.001°
in elevation, about 1/140 of the Sun's diameter. The comparison script and raw results are in the
repository (`validation/`, `docs/validation.md`). At this level the app's results are limited by
terrain and site position, not by the astronomy.

**Benefits**
NASA's site-selection update (George et al., LPSC 2026) notes that single regions rarely satisfy
every constraint at once and that several regions must be kept for launch flexibility. LASTLIGHT
makes that trade-off visible in seconds, in any browser, for experts and non-experts.

**Limitations (stated in the app)**
- **[remove if terrain ships]** Flat horizon: terrain is not included, so real sites can be darker.
- Region positions are one point per region, digitized from NASA's map (about ±3 km); regions are
  15–30 km wide.
- No thermal model, no lander-specific panel layout.

**Tools**
TypeScript, React, Vite, astronomy-engine, Recharts; Vercel hosting; GitHub. **[IF SHIPPED]** three.js,
Remotion.

## NASA Data
| Dataset | Use |
|---|---|
| Artemis III candidate regions (NASA, Oct 2024; George et al., LPSC 2026, NTRS 20250011660) | The 9 sites, positions digitized from NASA's official region map |
| NASA JPL Horizons | Validation of Sun/Earth azimuth and elevation |
| **[IF SHIPPED]** LRO LOLA south polar DEM (NASA PGDA / PDS) | Terrain horizon per site |

## Other Data
- astronomy-engine (MIT licence): Sun, Earth and Moon positions; IAU lunar rotation model.
- Athena (IM-2) facts: NASA and Intuitive Machines public statements; IM-2 target area from LROC
  (https://www.lroc.asu.edu/images/1401).
- Fonts: IBM Plex Sans and IBM Plex Mono (SIL Open Font License).

## Use of AI
- Code was co-written by the team with Claude Code (Anthropic) as a coding assistant.
- No scientific result is generated by AI: every number comes from the code in the repository.
- **[IF SHIPPED: film app]** The copilot only selects whitelisted UI actions; "Explain" rewrites a
  fact sheet and every number is checked against it.
- **[IF SHIPPED: video]** Voice-over generated with ElevenLabs, disclosed on screen.
- No NASA logos or insignia are used.

## References
1. George, T., Rubio, M. A., Lawrence, S. J., & Curell, P. (2026). Artemis III site selection update.
   Lunar and Planetary Science Conference. NTRS 20250011660.
2. NASA (2024). NASA provides update on Artemis III Moon landing regions.
   https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/
3. Archinal, B. A., et al. (2018). Report of the IAU Working Group on Cartographic Coordinates and
   Rotational Elements: 2015. Celestial Mechanics and Dynamical Astronomy, 130(22).
4. Cross, D. Astronomy Engine. https://github.com/cosinekitty/astronomy
5. NASA JPL Horizons System. https://ssd.jpl.nasa.gov/horizons/
