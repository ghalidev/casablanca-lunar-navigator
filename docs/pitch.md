# LASTLIGHT: pitch (3 minutes, live demo)

Audience: Casablanca local judges (not space specialists) who compare us with agriculture, water and
health projects. Goal: they understand the problem in 20 seconds, see it solved live, and remember one
sentence. Only say numbers that are published facts (cited) or shown live by the app.

Speaker split: Ghali (story + demo), Yasin (science + validation), Adam (data + map). Rehearse twice
with a timer.

---

## 0:00–0:25 · The hook (Ghali)
> "On 6 March 2025, a lander called Athena touched down near the lunar south pole. Less than 13 hours
> later, its mission was over. Its solar panels could not recharge.
> At the south pole, the Sun never rises high. It circles just above the horizon, and one hill can
> put you in the dark for days. You also need Earth above the horizon to call home."

## 0:25–0:45 · The problem (Ghali)
> "NASA has chosen 9 candidate regions for Artemis III, the next crewed landing. For every region and
> every date, planners need two answers: will we have sunlight, and will we see Earth?
> NASA's tools can answer that, but they are built for experts. Our challenge: make it fast and
> intuitive, for planners, teachers and the public."

## 0:45–2:00 · Live demo (Ghali drives, ~75 s): the 3D LASTLIGHT film
Open the live link before you start, on the first shot (the Moon). Scroll or press ↓ to move between shots.
1. **The Moon → the pole** (10 s): scroll once. "The Sun never sets here. It never rises either." Scroll again: the camera dives onto the pole.
   "NASA's 9 Artemis III regions, on NASA's laser-measured terrain." Click **Haworth**.
2. **On the ground** (25 s): "We're standing at Haworth. The Sun slides along the real skyline." Let it **play**.
   Point at the **14-day stripe**: "Green: power and a line home. Amber: power only. Blue: Earth only. Dark: battery only."
   Point at **Longest night**: "That is what the battery must survive."
3. **Compare** (15 s): click *Compare sites*. Tap two more pins: "Up to four regions, best value in green."
4. **Best landing windows** (15 s): click *Find the best dates*. "For a 6-day mission, Artemis III's planned stay, we tried
   a landing every 6 hours at every region for all of 2027, and ranked them." Click row 1: the film lands there on that date.
5. **Export** (5 s): "And a planner can export it all as CSV."
Backup if the 3D is slow on the venue laptop: the classic view (same numbers) at the second link.

## 2:00–2:30 · Why trust it (Yasin)
> "Every number is computed in your browser from the Moon's real orientation and the positions of the
> Sun and Earth. We checked our results against NASA JPL Horizons, the reference tool of NASA's
> Jet Propulsion Laboratory: 600 comparisons, and the largest difference is 0.004 degrees, less than
> one hundredth of the width of the Sun."
(Validation done: docs/validation.md.)

> "And the hills are real: every site's skyline comes from NASA's LOLA laser altimeter, out to
> 200 kilometres. What we don't model yet, we write on the screen."

## 2:30–2:50 · Impact (Adam)
> "NASA's own site-selection paper says a single region rarely meets every constraint, so several
> must stay open for launch flexibility. LASTLIGHT shows in seconds which site works on which date.
> It's open source, it runs in any browser, and a CSV export takes the numbers to a planner's tools."

## 2:50–3:00 · Close (Ghali)
> "LASTLIGHT: choose where and when your lander survives the lunar south pole. Thank you."

---

## Questions judges may ask
| Question | Answer |
|---|---|
| Where do the positions come from? | NASA publishes no coordinate table for the 9 regions; we read the centre of each region box on NASA's official map (George et al., LPSC 2026), about ±3 km. Documented in docs/assumptions.md. |
| How accurate is the Sun/Earth position? | IAU lunar orientation model + astronomy-engine; compared with JPL Horizons (docs/validation.md). |
| Where do the hills come from? | NASA LOLA elevation grid (474 m), 360 directions, out to 200 km, Moon curvature included (scripts/terrain_horizons.py). Smaller obstacles are not seen; we say so. |
| Did AI make the numbers? | No. Code was co-written with Claude Code; every number is computed by our code. The film app's copilot only triggers UI actions. |
| What's next? | Real terrain, landing-error uncertainty, survival odds per window, the Athena replay. |

## Demo checklist (5 minutes before)
- [ ] Live link open on the laptop, zoom 100%, dark room tested
- [ ] Second tab: phone screen or phone in hand to show it works on mobile
- [ ] Wi-Fi tested; offline fallback: `npm run dev` on the laptop
- [ ] Timer on the phone
