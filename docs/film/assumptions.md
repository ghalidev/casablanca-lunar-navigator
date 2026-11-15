> **Archived working notes (14–15 Nov), superseded.** They describe drafts and the first prototype and may contradict the final submission. The final submission, with its current results, validation and limits, is [`lastlight-final/`](../../lastlight-final/README.md) (start with its README).

# Film app: assumptions

Visual and modelling choices made in `web/`. None of them feeds a number shown as a result: results come from the data files.

| # | Assumption | Value | Why | Where |
|---|---|---|---|---|
| F1 | Relief exaggeration in the 3D scene | x2.5 on LOLA heights; Moon curvature is true | Ridges are unreadable at a Sun elevation of about 1.5 deg without it. Sun and Earth elevations are scaled with atan(2.5 tan el), so occlusion by the exaggerated relief matches occlusion by the real one. | `web/src/mission/terrain.ts` |
| F2 | Pole relief tile | LOLA global grid at 16 px/deg (about 1.9 km/px), resampled to 1024 x 1024, azimuthal equidistant, 82.5 S to 90 S, 0 deg longitude up, 90 E right | Web payload (about 5.5 MB for all Moon assets). Too coarse for horizons: the pipeline's 20 m DEM is the reference for numbers. | `web/scripts/prepare_moon.py` |
| F3 | Overview lighting (pole and Athena shots) | Raking light about 14 deg above the horizon, circling slowly, labelled "overview lighting" on screen | Readability. Only the ground shot uses Sun and Earth directions from the series file. | `web/src/mission/Mission.tsx` |
| F4 | Visible-disk threshold in the UI | A body counts as in view when at least half of its disk is above the horizon (`VISIBLE_FRAC = 0.5`) | Display convention for Sun/Earth badges and day counts, not a science parameter. | `web/src/data/stats.ts` |
| F5 | Ghost landers | Drawn at their `dx_m`, `dy_m` offsets and `tilt_deg` on the same relief, coloured when `died_at_h` is reached | They come from `survival/*.json`; mock until the pipeline ships. | `web/src/mission/MissionScene.tsx` |
| F6 | Athena marker | 84.7906 S, 29.1957 E (touchdown, secondary source: Wikipedia, IM-2) | LROC's published intended site is 84.78 S, 29.13 E (see A7 and the data-sources table at repo level). The two points are about 0.4 km apart; the marker is illustrative at that scale. | `web/src/mission/Mission.tsx` |
| F7 | Copilot and "Explain" | gpt-oss-120b on Groq, server side. The model only picks whitelisted UI actions or rewrites a fact sheet; digits are stripped from its narration and every number in an explanation is matched to the sheet, else a fixed template is shown. | The AI never produces a result. | `web/src/copilot/`, `web/src/ai/`, `web/api/`, `web/functions/api/` |
