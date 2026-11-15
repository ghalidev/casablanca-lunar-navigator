# Data sources

Every dataset, kernel, map, audio file used. Fill URL + version + licence + how we use it.

| Data | Provider | URL | Version / date | Use | Licence |
|---|---|---|---|---|---|
| LOLA elevation (global, `ldem_16_uint.tif` 16 px/deg / `ldem_64_uint.tif` 64 px/deg, uint16 half-metres +20000, relative to 1737.4 km) | NASA SVS CGI Moon Kit (ID 4720), from LRO LOLA | https://svs.gsfc.nasa.gov/4720 | downloaded 2026-11-15 | Terrain horizons + lander point (A11, A12) | Public domain (NASA) |
| SPICE kernels (de421.bsp, moon_080317.tf, moon_pa_de421_1900-2050.bpc, pck00008.tpc) | NASA NAIF | TBD | | Sun/Earth positions | Public domain |
| LROC WAC Time-Weighted South Pole Illumination Map | LROC / ASU | TBD | 2010-02-15 → 2011-02-05, 3,807 WAC images | Validation 1 | |
| Lunar Polar Illumination (Mazarico et al. 2011) | NASA PGDA | TBD | | Validation 2 | |
| Artemis III candidate regions (9-region map, "The 9 candidate landing regions") | NASA/GSFC/ASU/JSC/AGDT, via George, Rubio, Lawrence & Curell, LPSC 2026 abstract | https://ntrs.nasa.gov/citations/20250011660 ; list: https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ | Oct 2024 list | Site positions, digitized (assumption A7) | Public domain (NASA) |
| IM-2 (Athena) intended landing site 84.78°S, 29.13°E | LROC / ASU | https://www.lroc.asu.edu/images/1401 | 2025 | Athena story; falls inside the Mons Mouton Plateau box | |
| Athena (IM-2) landing site & time | NASA / LROC / IM | TBD | | Athena replay | |
| Voice-over | ElevenLabs (AI-generated) | — | | Video | |
| Music / SFX | TBD | | | Video | must be licensed |
| 3D models: Lunar Reconnaissance Orbiter (A), Apollo Lunar Module, Saturn V | NASA 3D Resources | https://github.com/nasa/NASA-3D-Resources (3D Models/…) | downloaded 2026-11-15 | Visual only in the 3D app (web/public/models/), shown enlarged, not to scale; labelled with info cards | Free to use (NASA 3D Resources usage guidelines) |
| Soundtrack | Generated in the browser (Web Audio), web/src/mission/sound.ts | — | 2026-11-15 | Optional background music | No third-party audio |
| Fonts: Host Grotesk, Geist Mono, IBM Plex Mono | Google Fonts / Fontsource | fonts.google.com | | UI text | SIL Open Font License |
