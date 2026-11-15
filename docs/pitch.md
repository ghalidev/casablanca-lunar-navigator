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

## 0:45–2:00 · Live demo (Ghali drives, ~75 s)
Open the live link. Have it loaded before you start. Planner mode.
1. **Map** (10 s): "These are NASA's 9 Artemis III regions, placed from NASA's official map." Click Haworth.
2. **Timeline** (15 s): "Amber is the Sun, blue is Earth, the dashed line is the horizon. Green stripes:
   power and a phone line. Black: dark and silent, the lander lives on its battery."
3. **Cards** (10 s): point at *Longest darkness*: "This is how long the battery must survive here."
4. **Sky view** (15 s): press **Play**. "This is the sky seen from the site. Watch the Sun skim the horizon."
5. **Compare** (10 s): "Three sites side by side. Green is the best in each row."
6. **Best dates** (15 s): mission length 6 days (Artemis III's planned surface stay), *Find best windows*.
   "In under a second it tries every landing date at every site and ranks them." Click the first row.
7. **Explore mode** (5 s): switch it on: "Same tool, plain words, for a classroom."

## 2:00–2:30 · Why trust it (Yasin)
> "Every number is computed in your browser from the Moon's real orientation and the positions of the
> Sun and Earth. We checked our results against NASA JPL Horizons, the reference tool of NASA's
> Jet Propulsion Laboratory: 600 comparisons, and the largest difference is 0.004 degrees, less than
> one hundredth of the width of the Sun."
(Validation done: docs/validation.md.)

> "And we say what we don't do yet: the horizon is flat, so real sites can be darker. Terrain from
> NASA's LOLA laser altimeter is our next step." (drop this line if the terrain ships)

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
| Why is the horizon flat? | Terrain needs NASA's LOLA elevation model; [shipped / in progress]. Flat horizon is labelled on screen. |
| Did AI make the numbers? | No. Code was co-written with Claude Code; every number is computed by our code. The film app's copilot only triggers UI actions. |
| What's next? | Real terrain, landing-error uncertainty, survival odds per window, the Athena replay. |

## Demo checklist (5 minutes before)
- [ ] Live link open on the laptop, zoom 100%, dark room tested
- [ ] Second tab: phone screen or phone in hand to show it works on mobile
- [ ] Wi-Fi tested; offline fallback: `npm run dev` on the laptop
- [ ] Timer on the phone
