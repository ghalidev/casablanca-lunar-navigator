# Data sources

Every dataset, kernel, image, audio file or library used by LASTLIGHT. Mandatory for submission.
Fill one row per source **before** using it. "Verified" = URL opened and format checked by a team member.

| # | Data | Provider | URL | Version / date | Used for | License / terms of use | Verified |
|---|---|---|---|---|---|---|---|
| 1 | LOLA south polar DEM `LDEM_80S_20MPP_ADJ.TIF` (80–90°S, 20 m/px, ~2.6 GB, polar stereographic) — Barker et al. 2021, doi:10.1016/j.pss.2020.105119 | NASA GSFC PGDA | https://pgda.gsfc.nasa.gov/products/90 | ADJ release | Far horizon (to ~150 km) | NASA (public) | **Used**: downloaded to the Modal Volume 2026-11-15 (2.7 GB), 20 m horizon near each site |
| 1d | LOLA south polar DEM `LDEM_60S_240MPP_ADJ.TIF` (60–90°S, 240 m/px, 219 MB) | NASA GSFC PGDA | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF | ADJ release | Far horizon (30–150 km), sites near 80°S | NASA (public) | **Used** (downloaded 2026-11-15) |
| 1b | LOLA 5 m/px landing-site DEMs (local, around targets) | NASA GSFC PGDA | https://pgda.gsfc.nasa.gov/products/78 and https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/ | | Fine grid for Crash Test | NASA (public) | URL found |
| 1c | Older PDS name `LDEM_80S_20M` (30400×30400 px, IMG ~1.76 GB) | PDS Geosciences / MIT mirror | https://imbrium.mit.edu/BROWSE/LOLA_GDR/POLAR/SOUTH_POLE | pre-ADJ | Fallback only | NASA (public) | URL found |
| 2 | SPICE kernels `de421.bsp`, `moon_080317.tf`, `moon_pa_de421_1900-2050.bpc`, `pck00008.tpc` (downloaded by Skyfield from NAIF) | NASA NAIF | https://naif.jpl.nasa.gov/naif/data.html | DE421, 2008 | Sun/Earth ephemerides and lunar orientation, 2027–2030 | NASA (public) | **Used** |
| 3 | LROC WAC Time-Weighted South Pole Illumination Map `WAC_POLE_ILL_TWI_SOUTH_100M` (88–90°S, 100 m/px; images in sparse periods weighted ×2; companion un-weighted `WAC_POLE_ILL_PCT_SOUTH`) | LROC / ASU | https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_TWI_SOUTH (PDS: LRO-L-LROC-5-RDR-V1.0, EXTRAS/BROWSE/WAC_POLE/) | 2010-02-15 → 2011-02-05, 3,807 WAC images | Validation 1 | Check LROC site terms | no |
| 4 | PGDA Lunar Polar Illumination (Mazarico et al. 2011) | NASA GSFC PGDA | https://pgda.gsfc.nasa.gov/products/69 | | Validation 2 | NASA (public) | no |
| 5 | Artemis III candidate regions (names: NASA release 2024-10-28; George et al., LPSC 2026, NTRS 20250011660) | NASA | https://ntrs.nasa.gov/api/citations/20250011660/downloads/AIIIUpdateLPSC2026.docx | | Site list | NASA (public) | names verified; **no official numeric coordinates found** (NASA SVS 5013 = old 13-region list, no KML; LPI atlas 403). → digitize from NASA region map, document as approximation |
| 6 | Athena (IM-2) landing: 84.7906°S, 29.1957°E, 2025-03-06 17:28:50 UTC (secondary source: Wikipedia IM-2; must be confirmed against the LROC post-landing image release before use) | LROC / NASA / Intuitive Machines | https://en.wikipedia.org/wiki/IM-2 | | Athena Replay | | secondary only |
| 7 | Voice-over | ElevenLabs (AI-generated) | — | | Video | ElevenLabs terms of use | no |
| 8 | Music: “Mesmerizing Galaxy” (loop), Kevin MacLeod | incompetech.com | https://incompetech.com/music/royalty-free/ | downloaded 2026-11-15 | Video | CC BY 4.0, credit shown on screen at the end and in the description: “Music: Mesmerizing Galaxy by Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0” | yes |
| 9 | SFX: generic risers, whooshes, impacts (no game or meme sounds) | team's editing library (Yassine) | local | | Video | licence held by the team member who supplied them (to confirm before publishing) | partial |
| 10 | NASA SVS CGI Moon Kit (ID 4720): `lroc_color_poles_4k.tif`, `ldem_16_uint.tif`, `ldem_4_uint.tif` (LROC WAC colour, LOLA elevation) | NASA GSFC Scientific Visualization Studio (Ernie Wright) | https://svs.gsfc.nasa.gov/4720 | 2019, updated 2026-01-09 | Web 3D only: globe, south-pole relief tile, normal map (`web/scripts/prepare_moon.py` → `web/public/moon/`). Not used for any computed result. | NASA imagery, public | yes (downloaded 2026-11-14) |
| 10 | NASA SVS CGI Moon Kit (ID 4720): `lroc_color_poles_4k.tif`, `ldem_16_uint.tif`, `ldem_4_uint.tif` (LROC WAC colour, LOLA elevation) | NASA GSFC Scientific Visualization Studio (Ernie Wright) | https://svs.gsfc.nasa.gov/4720 | 2019, updated 2026-01-09 | Web 3D only: globe, south-pole relief tile, normal map (`web/scripts/prepare_moon.py` → `web/public/moon/`). Not used for any computed result. | NASA imagery, public | yes (downloaded 2026-11-14) |

## Required notice (from the Space Apps / Morocco organizers)

Reproduce verbatim in the web app footer and on the project page:

> NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites. For non-U.S. Government websites, participants must comply with any data use parameters of that specific website.

→ For every non-NASA source above (LROC/ASU if hosted outside nasa.gov, Intuitive Machines, ElevenLabs, music, SFX), the "License / terms of use" column must be filled and respected.
