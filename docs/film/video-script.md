# LASTLIGHT — video script (30 s)

Constraints (Space Apps rules, summarised in `docs/LASTLIGHT-brief.md` §7): 30 s max, burned-in English subtitles, ≤ 60 words of voice-over, AI voice disclosed on screen, real app captures only, licensed music/SFX only. 1920×1080, 30 fps.

Placeholders `{{…}}` are filled from pipeline files before generating the MP3 (see the table at the end). Nothing in this script may be replaced by a number that is not in those files.

---

## Shots

| # | Time | Voice-over | On-screen text | Visual (real app capture) | SFX / music |
|---|---|---|---|---|---|
| 1 | 0:00–0:05 | March 2025. Athena lands at the lunar south pole. Thirteen hours later, it's dead. | `MARCH 6, 2025` then `+13 HOURS` | Black. The Athena illustration from Home fades in, lander on its side; the panel glow dies. | Low drone starts. Single soft radio blip at "dead", then silence. |
| 2 | 0:05–0:10 | Here, the Sun never rises. It circles the horizon. | `LASTLIGHT` / team name / *Lunar Landing Site Navigator* | Home 3D scene: Sun grazing the ridge line, shadows sweeping across the terrain, status pill flips to "running on battery". | Drone opens up, slow pulse. |
| 3 | 0:10–0:15 | One ridge, and your lander goes dark. | `Built on NASA LOLA terrain` | Site page: 360° horizon ring playing at 1 week/s, Sun sliding behind a peak, "Sun hidden" card lights up. | Soft whoosh as the Sun disappears. |
| 4 | 0:15–0:21 | We land {{N_DRAWS}} times before anyone flies. | `Validated against 3,807 LRO images` | Crash Test: ghosts drop in, the timeline plays, some turn red; survival curve draws. | Light ticks as ghosts land; one low tone as red ones appear. |
| 5 | 0:21–0:27 | Safest window: {{TOP1_SITE}}, {{TOP1_DATE}}. {{TOP1_P_SURVIVE}} survive two weeks. | `{{TOP1_SITE}} · {{TOP1_DATE}} · {{TOP1_P_SURVIVE}}` | Plan page: cards re-rank as the date changes, #1 card highlighted. | Music resolves. |
| 6 | 0:27–0:30 | Open source, for every mission to the pole. | `github.com/ShizKN/lastlight` · small: `AI-generated voice` | Home hero, wide, Sun on the horizon. Cut to black. | Final note, fade out. |

Voice-over: 60 words with a worst-case fill ("one thousand", a three-word site name, "March fourteenth twenty twenty-eight", "ninety-seven percent"), about 26 s at a calm pace. Re-count after filling; cut "for every mission" first if over.

---

## ElevenLabs

**Voice direction:** calm, low, documentary. Slow, steady pace. Clear pauses between sentences; a longer pause after "it's dead". No dramatic acting, no smile in the voice. Target duration about 26 seconds.

**Text to paste** (after filling the placeholders). Don't fill them by hand: run

```bash
python3 video/fill_voiceover.py
```

It reads `web/public/data/top10.json`, spells the numbers out for the voice, prints the subtitle version with digits, counts the words, and refuses to run on mock data.

The block with placeholders:

```
March 2025. Athena lands at the lunar south pole.
Thirteen hours later, it's dead.

Here, the Sun never rises. It circles the horizon.

One ridge, and your lander goes dark.

We land {{N_DRAWS}} times before anyone flies.

Safest window: {{TOP1_SITE}}, {{TOP1_DATE}}.
{{TOP1_P_SURVIVE}} survive two weeks.

Open source, for every mission to the pole.
```

Write numbers in words in the pasted text so the voice reads them naturally (for example "one thousand", "ninety-seven percent", "March fourteenth, twenty twenty-eight"). Keep digits in the subtitles.

Save the MP3 as `assets/audio/voice.mp3`.

---

---

## Version B: ready now, no pipeline numbers (use this if top10.json is not out)

Paste as is into ElevenLabs:

```
March, twenty twenty-five. Athena lands at the lunar south pole.
Thirteen hours later, it's dead.

Here, the Sun never rises. It circles the horizon.

One ridge, and your lander goes dark.

So we crash it first. Thousands of times, on NASA's real terrain.

LASTLIGHT tells you where, and when, your lander survives.

Open source, for every mission to the pole.
```

59 words. Shot 4 covers "So we crash it first…" (Crash Test capture), shot 5 becomes "LASTLIGHT tells you where, and when…" over the Plan page re-ranking, without any percentage on screen. Subtitles: same text, "March 2025".

## Placeholders and where each value comes from

| Placeholder | Source file | Field |
|---|---|---|
| `{{N_DRAWS}}` | `web/public/data/top10.json` | `windows[0].n_draws` |
| `{{TOP1_SITE}}` | `web/public/data/top10.json` + `sites.json` | `windows[0].site_id` → `sites[].name` |
| `{{TOP1_DATE}}` | `web/public/data/top10.json` | `windows[0].landing_utc` (date only, UTC) |
| `{{TOP1_P_SURVIVE}}` | `web/public/data/top10.json` | `windows[0].p_survive_14d` as a whole percent |

Fixed facts used (all from `docs/LASTLIGHT-brief.md` §1 and `docs/data-sources.md`): Athena landed on 6 March 2025 and stopped working in under 13 hours; LOLA terrain; 3,807 LRO WAC images in the LROC illumination map.

If the pipeline is not finished by Sunday 12:00: drop shot 5, stretch shot 4 to 0:15–0:24 and shot 6 to 0:24–0:30, and do not show any survival number.

## Checklist before export
- [ ] Every placeholder filled from the files above, values copied into `docs/log.md` with the `params_ref`.
- [ ] No "MOCK DATA" banner visible in any capture.
- [ ] Subtitles burned in, matching the voice exactly.
- [ ] "AI-generated voice" visible on screen.
- [ ] Music and SFX files listed with their license in `docs/data-sources.md`.
- [ ] Length ≤ 30.0 s.

---

## Recorded voice (version B) — 14/11 19:26

File: `assets/audio/voice.mp3` (ElevenLabs, 26.3 s). Transcript checked with Whisper: matches the script word for word. Word-level timings for subtitles and cuts: `assets/audio/voice-timings.json`.

| Shot | Cut at | Line |
|---|---|---|
| 1 Athena | 0.00 | March 2025. Athena lands at the lunar south pole. Thirteen hours later, it's dead. |
| 2 Home 3D | 7.50 | Here, the Sun never rises. It circles the horizon. |
| 3 Horizon ring | 11.64 | One ridge, and your lander goes dark. |
| 4 Crash Test | 14.28 | So we crash it first. Thousands of times, on NASA's real terrain. |
| 5 Plan | 19.62 | LASTLIGHT tells you where, and when, your lander survives. |
| 6 Outro | 23.46 | Open source, for every mission to the pole. (end 26.36, hold to 30.0) |
