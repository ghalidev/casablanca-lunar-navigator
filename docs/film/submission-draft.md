> **Archived working notes (14–15 Nov), superseded.** They describe drafts and the first prototype and may contradict the final submission. The final submission, with its current results, validation and limits, is [`lastlight-final/`](../../lastlight-final/README.md) (start with its README).

> **DRAFT, to adapt before submitting.** Written for the 3D film app (`web/`) before the team's scope decision.
> The root app is the reference build. Parts that describe the Python / Skyfield / Modal pipeline, LOLA horizons, the Monte Carlo
> survival model or the AI copilot are only true if those parts ship: keep what ships, cut the rest. Every number must come from a file in
> `public/data/` (or `web/public/data/`); placeholders `{{...}}` stay empty until then.

# Submission texts (NASA Space Apps 2026)

Paste these into the project page fields. Items in `[TODO]` must be filled before submitting. Every number below is either a published fact (cited) or a placeholder `{{…}}` filled from `web/public/data/top10.json`. Do not add numbers that are not in those two categories.

---

## Project Name
LASTLIGHT

## High-Level Summary
*(about 150 words)*

At the lunar south pole the Sun never climbs more than a degree or two above the horizon, so a ridge far away can switch a lander's power off for days. In March 2025 the Athena lander touched down on Mons Mouton, one of NASA's nine Artemis III candidate regions, and stopped working in under 13 hours. LASTLIGHT lets anyone compare those nine regions and any landing date: it computes the real terrain skyline from NASA's LOLA laser altimetry, tracks the Sun and Earth hour by hour with NAIF SPICE ephemerides, and shows when each site has power and a direct radio link to Earth. Then it goes further: it simulates {{N_DRAWS}} landings around each target, with landing error, tilt and launch delay, and reports the chance that a lander is still alive after 14 days. Our headline result: the safest landing windows at the south pole from 2027 to 2030.

## Link to Demo
[TODO: YouTube unlisted or Drive link to the 30 s video]

## Link to Final Project
[TODO: Vercel production URL, public, no login]

## Detailed Description

**What it does.** LASTLIGHT answers three questions for the nine Artemis III candidate regions:
1. *Where and when is there sunlight and a view of Earth?* The site page shows a 360° skyline computed from terrain data, with the Sun and Earth moving over it, hour by hour. The Plan page ranks all nine sites for any landing date and mission length (6 days for an Artemis III crew stay, 14 days for a robotic lander, 28 days for a full lunar day).
2. *Will my lander survive there?* The Crash Test page drops simulated landers around the target, each slightly off course and tilted, follows each battery hour by hour, and shows how many are still alive after 14 days, and how many days of launch delay the window can absorb.
3. *Can we trust it?* The Method page compares our illumination results with the LROC map built from 3,807 Wide Angle Camera images of the pole, and lists what we do not model.

**How it works.**
- Terrain: LOLA 20 m/pixel south polar DEM, covering 80° S to the pole. For each site we cast rays in 720 directions out to about 150 km, correct for the Moon's curvature, and keep the highest elevation angle. That is the local skyline.
- Sun and Earth: positions from NAIF SPICE kernels (DE ephemeris and lunar orientation), computed in the Moon-fixed frame once per hour and rotated into each site's local horizon.
- Visibility: the fraction of the solar and Earth disks above the skyline, hour by hour, from 2027 to 2030.
- Power and survival: a generic lander with vertical solar panels, a battery and a constant load. A Monte Carlo simulation varies the landing point (spread motivated by Athena's 250 to 400 m miss), the tilt, the heading and the launch date. A lander dies when its battery is empty.
- Validation: we run the same model over the year the LROC illumination map covers (15 February 2010 to 5 February 2011) and compare, spot by spot. [TODO: bias and RMSE from `docs/figures/` once computed.]

**Why it matters.** NASA's own site selection update (George et al., LPSC 2026) notes that a single region rarely meets every constraint at once and that several regions must be kept open for launch flexibility. LASTLIGHT shows which regions back each other up on any date, and how much delay each window can take. It is open source, works in a browser, and is written so a mission planner, a teacher and a curious student can all use it.

**Tools.** Python 3.11, NumPy, Numba, Skyfield (SPICE), Modal for the heavy terrain computation; React, TypeScript, Vite, three.js (react-three-fiber) and Motion for the web app; Vercel for hosting; Remotion for the video.

## NASA Data
| Dataset | How we use it |
|---|---|
| LRO LOLA south polar DEM, `LDEM_80S_20MPP_ADJ` (Barker et al. 2021), PGDA | Terrain skyline for every site, 720 directions out to about 150 km |
| LRO LOLA 5 m/pixel landing-site DEMs, PGDA | Fine terrain around the targets for the landing simulation |
| NAIF SPICE kernels (planetary ephemeris, lunar frame and orientation) | Hourly Sun and Earth positions seen from each site |
| LROC WAC Time-Weighted South Pole Illumination Map (3,807 images, 2010 to 2011) | Validation of our illumination results against real photos |
| PGDA Lunar Polar Illumination (Mazarico et al. 2011) | Second validation against NASA's own illumination model |
| Artemis III candidate regions (NASA, 28 October 2024; George et al., LPSC 2026) | The nine sites we compare |

## Other Data
- Athena (IM-2) landing site and time: [TODO: confirm coordinates against the LROC post-landing image release; currently from a secondary source, see `docs/data-sources.md`].
- Region positions: no official numeric table was found; positions were digitized from NASA's published region map and are approximate (documented in `docs/assumptions.md`).
- Fonts: Bricolage Grotesque and Atkinson Hyperlegible (SIL Open Font License).
- [TODO: music and sound effects with their licenses.]

## Use of AI
- **Code:** written by the team with Claude Code (Anthropic) as a coding assistant.
- **Explanations in the app:** the "Explain" button sends a sheet of numbers computed by our pipeline to an open model (gpt-oss-120b, served by Groq), which rewrites them in plain language for three audiences. A checker compares every number in the generated text with the sheet and rejects any number it cannot trace; in that case the app shows a fixed template instead. The model never sees free text from users and never produces a result.
- **Video:** the voice-over is AI-generated (ElevenLabs). This is stated on screen.
- **No scientific result** in LASTLIGHT (skylines, visibility, power, survival, validation) is produced by AI. All of it comes from geometric computation on NASA data.
- No NASA logos, insignia or imagery are used in AI-assisted content.

## References
1. Barker, M. K., et al. (2021). A new view of the lunar south pole from the Lunar Orbiter Laser Altimeter (LOLA). *Planetary and Space Science*, 203. doi:10.1016/j.pss.2020.105119
2. Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., & Torrence, M. H. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus*, 211(2).
3. George, T., Rubio, M. A., Lawrence, S. J., & Curell, P. (2026). Artemis III site selection update: downselection from thirteen to nine candidate regions. *Lunar and Planetary Science Conference*. NTRS 20250011660.
4. NASA (2024, October 28). NASA provides update on Artemis III Moon landing regions.
5. LROC / Arizona State University. WAC Time-Weighted South Pole Illumination Map (`WAC_POLE_ILL_TWI_SOUTH`).
6. Acton, C. H. (1996). Ancillary data services of NASA's Navigation and Ancillary Information Facility. *Planetary and Space Science*, 44(1). (SPICE)

---

## Challenge requirement → LASTLIGHT feature
| The challenge asks for | Where LASTLIGHT does it |
|---|---|
| Compare potential landing sites at the lunar south pole | Landing sites page (map of the nine regions) and Plan page (ranked comparison) |
| Compare landing dates | Plan page: any date, one-week steps, 6/14/28-day missions; site page time slider |
| Visualize the Sun and Earth relative to the local horizon | Site page: animated 360° skyline with Sun and Earth tracks |
| Evaluate solar power | Sunlit share, longest night, power on a Sun-facing panel; battery simulation in Crash Test |
| Evaluate direct-to-Earth communication windows | Earth-in-view share and longest gap; blue Earth strip on every timeline |
| Usable by mission planners | Numbers per window, survival probability, launch-delay tolerance, shareable URLs |
| Usable by educators and the public | Home 3D story, plain-language verdicts, "Explain" for three audiences |
| *Beyond the brief* | Monte Carlo survival under landing error and launch delay; validation against 3,807 LRO images; Athena story |

## Checklist before pressing Submit
- [ ] Vercel production URL works without login, on a laptop and a phone, with no console errors.
- [ ] No "Mock data" banner anywhere.
- [ ] Every `{{…}}` and `[TODO]` above filled.
- [ ] Validation figures uploaded (`docs/figures/`).
- [ ] Video ≤ 30 s, public link, AI voice disclosed.
- [ ] `docs/data-sources.md`, `docs/assumptions.md`, `docs/limitations.md` up to date.
