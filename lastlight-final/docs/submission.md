# Submission texts (NASA Space Apps 2026)

Paste these into the project page fields. Field names below are the exact 2026 ones (Project Submission Guide, 13 Nov 2026). Every number below is either a published fact (cited) or read from the pipeline output in `web/public/data/` (params_ref `319725853747`), with the file named next to it in the source notes at the end. Do not add numbers that are not in those two categories. The only open item is the video link.

---

## Project Name
LASTLIGHT

## High-Level Project Summary

At the lunar south pole the Sun never climbs more than a few degrees above the horizon, so a ridge kilometres away can switch a lander's power off for days. In March 2025 the Athena lander touched down at Mons Mouton, one of NASA's nine Artemis III candidate regions, landed on its side in a crater, and went silent in under 13 hours. LASTLIGHT asks the question every polar mission now has to answer: if we aim here, on this day, will the lander survive? It computes each region's real skyline from NASA LOLA laser altimetry, follows the Sun and Earth hour by hour with NAIF SPICE, and crash-tests 1,000 simulated landings for every day from 2027 to 2030, each one off target and tilted by the real terrain. Result: only Malapert Massif gives a generic lander a 95% chance of lasting 14 days, on 12 days out of 1,447, and landing one day late already costs about five points.

## Link to Project Demo
https://www.youtube.com/watch?v=ykuUuBfE5Ec (unlisted, 29 s, English subtitles burned in, AI-generated voice stated on screen, in the video description and in the file metadata)

## Link to Final Project
https://lastlight.apospace.com (public, no login, works on laptop and phone). Source code: https://github.com/ghalidev/casablanca-lunar-navigator. The Planner is at https://lastlight.apospace.com/explore

## Detailed Project Description

**What it does.** LASTLIGHT is one continuous 3D film you can steer, built on real NASA terrain:
1. **Athena.** The camera flies from the whole Moon to Mons Mouton, where Athena landed on its side.
2. **The pole.** The nine Artemis III regions on the real relief. Drag the landing date: each region shows its chance of surviving 14 days if you land that day, and a calendar shows the whole year at once. Pick two regions to compare them side by side (survival, sunlight, Earth in view, longest night, longest radio silence).
3. **Crash test.** 1,000 simulated landers drop around the target for the day you picked. Each one lands off target and tilted by the terrain under it. Two weeks play out in seconds: a lander's light goes out when its battery runs out. The count of survivors on day 14 is exactly the percentage shown on the pole. A slider asks "what if your lander only tolerates 10° of tilt?".
4. **On the ground.** Stand at the site: the Sun skims the computed skyline, the Earth rises and sets, and the panel tells you when you have power and a radio link.
5. **Verdict.** The ten safest landing windows from 2027 to 2030, exportable as CSV.
6. **Method.** How it works, what was checked, what is not modelled.

Beside the film, the **Planner** (`/explore`) fits on one screen for mission planners: pick one of the nine regions (each shows its survival on the chosen day, so the picker is the comparison), pick a day on a 2027–2030 survival strip, and read the verdict over a live 3D view from the site, with the Sun and Earth labelled in the sky: how many of 1,000 simulated landers are still powered after 14 days, Sun and Earth in view, the longest night, how many days the launch can slip, and the 360° skyline with the Sun's and Earth's paths driven hour by hour. CSV of every day of a region, shareable link.

Every view has a shareable URL (shot, site and date), and one landing day drives everything on screen. A copilot bar drives the film two ways: plain English ("compare Haworth and Malapert", "find the best day in October"), handled by a language model that may only trigger whitelisted actions and never produces a number; or LASTLIGHT's own command language, which runs locally with no AI at all: `/tp malapert 2027-10-08`, `/crash haworth`, `/stats nobile-rim-2`, `/date +7`, `/compare haworth malapert`, `/best`, chained with `;` (type `/help` in the app).

**How it works.**
- *Skyline.* For each region, 720 directions (every 0.5°), rays out to 150 km over the LOLA 20 m/pixel DEM near the site (30 km) and the 240 m/pixel DEM beyond, corrected for the Moon's curvature; the highest elevation angle is the skyline. Computed for 2 m and 10 m masts, and for a grid of 1,681 points (every 40 m, ±800 m) around each target for the crash test. Heavy computation runs on Modal, with Numba.
- *Sun and Earth.* Skyfield with NAIF SPICE kernels (DE421, lunar frame `MOON_ME_DE421`), every hour from 2027 to 2030, rotated into each point's local horizon. The visible fraction of the Sun's and Earth's discs above the skyline is computed hour by hour.
- *Survival.* A generic lander: four vertical solar panels (0.75 m², 28% each), a 2.5 kWh battery, a constant 60 W load. Each simulated landing draws a landing error (200 m per axis, chosen so the average miss matches Athena's published 250 m), a tilt equal to the terrain slope at the touchdown point plus 2° of noise (above 15° it tips over), and a random heading. Then the battery is followed hour by hour for 14 days with the real Sun direction and the real skyline at that exact spot. 1,000 landings per day, every day from 2027 to 2030, for 9 regions: about 13 million simulated landings. Every random number is a pure function of (site, day, landing), so the browser rebuilds the exact landers the pipeline simulated.
- *Launch delay.* For each day, how many following days stay above 95%.

**What we found.**
- Best 14-day survival per region over 2027 to 2030: Malapert Massif 96.4%, Nobile Rim 2 92.3%, Mons Mouton Plateau 84.5%, Haworth 83.9%, Slater Plain 83.1%, Nobile Rim 1 76.6%, Mons Mouton 72.9%, de Gerlache Rim 2 72.4%, Peak near Cabeus B 57.4%.
- The ten windows above 95% are all at Malapert Massif (95.1% to 96.4%), with the Earth in view 98% to 100% of the time.
- Good windows are narrow. At the best one (15 October 2029, 96.4%), landing one day later gives 91.6%, three days later 72.6%. A launch slip matters as much as the choice of site.
- Rankings hold when the lander changes: Malapert stays first in 7 of 8 variants (battery 1.5 or 4 kWh, load 40 or 90 W, landing error 100 or 400 m, tilt limit 10°). The exception is a lander tolerating 20° of tilt, where steep Nobile Rim 2 comes first. Absolute percentages move a lot; the order much less.

**What we checked.**
- Sun elevation never exceeds the physical limit at each latitude (90° minus latitude plus 1.6°): within 0.05° at the seven regions checked.
- Our Sun and Earth angles against an independent implementation (astronomy-engine, different ephemeris): largest difference 0.014° over every hour of 2027. That implementation agrees with NASA JPL Horizons to 0.004° (600 comparisons).
- Survivors in the crash test equal the published probability for every site and every day of 2027 (automated test).

**What we do not claim.** The survival percentage is a power-survival index of a generic lander (not any real vehicle) for comparing places and days, not the probability that a real mission succeeds; 96.4 % = 964 of 1,000 draws (95 % interval 95.1–97.4 %). No thermal model in those percentages (survival is likely overestimated); the Planner offers a one-node thermal model and your own lander numbers. Against real photographs (LROC illumination map, 3,807 images, 2010–11), the only region inside the 88–90°S map, de Gerlache Rim 2, is sunlit 87 % of the year in the photos and 61 % in our model: our skyline is pessimistic there (docs/validation-lroc.md). Our skyline differs from a coarser 474 m one by 0.3° to 2.5° on average. Reproduce the published numbers in one second: `python3 pipeline/verify_published.py`. Region positions are digitized from NASA's map (about 3 km). All of this is on the Method page.

**Why it matters.** Of the first four CLPS landing attempts (to March 2025), two ended with the lander on its side, and Athena's mission ended in hours instead of days. NASA's own site selection update (George et al., LPSC 2026) notes that no single region meets every constraint and that several must stay open for launch flexibility. LASTLIGHT turns that into a daily answer: where, when, and how much delay you can afford. It is open, runs in any browser, and speaks to a mission planner, a teacher and a student with the same screen.

**Tools.** Python 3.11, NumPy, Numba, Rasterio, Skyfield (SPICE), Modal; React, TypeScript, Vite, three.js (react-three-fiber); Cloudflare Pages; Remotion for the video.

## NASA Data
| Dataset | How we use it |
|---|---|
| LRO LOLA south polar DEM `LDEM_80S_20MPP_ADJ` (20 m/pixel; Barker et al. 2021), NASA GSFC PGDA | Skyline within 30 km of each site, terrain slope for the crash test |
| LRO LOLA south polar DEM `LDEM_60S_240MPP_ADJ` (240 m/pixel), NASA GSFC PGDA | Skyline from 30 to 150 km |
| NAIF SPICE kernels (DE421, `moon_080317.tf`, `moon_pa_de421_1900-2050.bpc`, `pck00008.tpc`) | Hourly Sun and Earth positions from each site, 2027 to 2030 |
| NASA SVS CGI Moon Kit (ID 4720): LROC WAC colour and LOLA elevation | The 3D Moon and south-pole relief in the web film (display only, no computed result) |
| Artemis III candidate regions (NASA, 28 October 2024; George et al., LPSC 2026) | The nine regions we compare |
| LROC IM-2 landing region release (ASU / NASA) | Athena's intended site (84.78° S, 29.13° E) |

## Space Agency Partner Data and Other References
No Space Agency Partner data was used; all science data is NASA's (above). Other resources:
- Athena touchdown point 84.7906° S, 29.1957° E and time 2025-03-06 17:28:50 UTC: secondary source (IM-2 article, Wikipedia); 250 m from LROC's published intended site, consistent with Intuitive Machines' statement.
- Region positions: no official numeric table was found; positions were digitized from NASA's published region map by our team (about 3 km uncertainty, documented in `docs/assumptions.md`).
- Sun and Earth cross-check: astronomy-engine (MIT licence), itself checked against NASA JPL Horizons.
- Video music: “Mesmerizing Galaxy” by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0. Sound effects: generic pops, swooshes, clicks and chimes from the team's editing library.
- Fonts: IBM Plex Sans, Sans Condensed and Mono (SIL Open Font License).

## Use of Super Intelligence (SI)
SI was used as a tool, not to come up with the idea or the method. Where it appears in the project:
- **Code:** written by the team with Claude Code (Anthropic) as a coding assistant.
- **Copilot in the app:** an open model served by Groq turns a plain-English request into one of a few whitelisted actions (fly to a site, set a date, compare two sites, find the best day). It never writes a number shown on screen; every number comes from the pipeline files.
- **Video:** the voice-over is AI-generated (ElevenLabs). Stated on screen ("AI-generated voice"), in this text and in the video file's metadata. No image or video frame is AI-generated: every visual is rendered by our code from NASA data.
- **Code:** acknowledged in the repository README and in the site's Method page.
- **No scientific result** (skylines, visibility, power, survival, rankings) is produced by AI. All of it is geometric computation on NASA data, and every number can be traced to a file in `web/public/data/`.
- No NASA logos, insignia or mission identifiers are used, in generated content or anywhere else.

## References
1. Barker, M. K., et al. (2021). Improved LOLA elevation maps for south pole landing sites: error estimates and their impact on illumination conditions. *Planetary and Space Science*, 203, 105119. doi:10.1016/j.pss.2020.105119
2. Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., & Torrence, M. H. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus*, 211(2), 1066–1081.
3. George, T., Rubio, M. A., Lawrence, S. J., & Curell, P. (2026). Artemis III site selection update. *Lunar and Planetary Science Conference*. NTRS 20250011660.
4. NASA (2024, October 28). NASA provides update on Artemis III Moon landing regions.
5. LROC / Arizona State University. IM-2 Landing Region (https://www.lroc.asu.edu/images/1401) and WAC South Pole Illumination Map (`WAC_POLE_ILL_TWI_SOUTH`).
6. Acton, C. H. (1996). Ancillary data services of NASA's Navigation and Ancillary Information Facility. *Planetary and Space Science*, 44(1), 65–70.
7. Rhodes, B. Skyfield: high precision research-grade positions for planets and Earth satellites. https://rhodesmill.org/skyfield/
8. NASA Scientific Visualization Studio (2019, updated 2026). CGI Moon Kit, ID 4720. https://svs.gsfc.nasa.gov/4720

## Required notice
NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites. For non-U.S. Government websites, participants must comply with any data use parameters of that specific website.

---

## Challenge requirement → LASTLIGHT feature
| The challenge asks for | Where LASTLIGHT does it |
|---|---|
| Compare potential landing sites at the lunar south pole | The pole: nine regions on real relief, each with its survival chance for the chosen day; compare two side by side |
| Compare landing dates | Date scrubber over the whole year with a site × day calendar; the ten best windows 2027–2030 |
| Visualize the Sun and Earth relative to the local horizon | On the ground: the computed 360° skyline with the Sun and Earth moving over it, hour by hour |
| Evaluate solar power | Sun-disc fraction and power on vertical panels every hour; battery followed for 14 days in the crash test |
| Evaluate direct-to-Earth communication windows | Earth in view (at least half its disc above the skyline) every hour; longest radio silence in the comparison |
| Usable by mission planners | Survival probability per day, launch-delay tolerance, sensitivity to the lander, CSV export, shareable URLs |
| Usable by educators and the public | A guided 3D film, one short sentence per screen, a copilot that answers in plain English |
| *Beyond the brief* | 13 million simulated landings under landing error and terrain tilt; Athena's story; every number traceable to the pipeline |

## Source of each number (for the team)
- 96.4%, 15 Oct 2029, 95.1–96.4%, ten windows at Malapert, Earth 98–100%: `web/public/data/top10.json`.
- Best per region: `web/public/data/survival/*.json` (max `p_survive_14d`), also `docs/validation-pipeline.md` §5.
- 12 days of 1,447 at ≥ 95%, 91.6% one day later, 72.6% three days later: `web/public/data/survival/malapert-massif.json`.
- 13 million landings: 1,000 draws × 1,447 days × 9 regions (`n_draws`, `windows` in the survival files).
- 0.014°, 0.004°, 0.05°: `docs/validation-pipeline.md` §1–2. Sensitivity: `docs/sensitivity.md`.
- Lander and landing parameters: `pipeline/config.py`.

## Checklist before pressing Submit
- [x] Production URL works without login (Cloudflare Pages).
- [x] No "Mock data" banner (all data `mock: false`).
- [x] Video is 29 s (rule: 30 s or less, or the project is not eligible for Global Judging).
- [x] Video uploaded to YouTube (unlisted, no login): https://www.youtube.com/watch?v=ykuUuBfE5Ec
- [ ] YouTube description states "Voice-over: AI-generated (ElevenLabs)" (SI rule for audio).
- [x] No image, video or audio of anyone under 18 in the demo or the final project (team photo removed from the site).
- [ ] Both boxes ticked: Terms and Conditions, and "Confirm All Work is Original" (all references listed).
- [ ] "Submit for Judging" clicked before Sunday 15 Nov, 23:59 Casablanca time. Re-submitting before then is allowed; only the last save counts.
- [ ] Team repo https://github.com/ghalidev/casablanca-lunar-navigator holds the code we ship (film app is PR #2 there: merge it, or the link shows a different app).
- [ ] Phone check on a real device.
