> **Archived working notes (14–15 Nov), superseded.** They describe drafts and the first prototype and may contradict the final submission. The final submission, with its current results, validation and limits, is [`lastlight-final/`](../../lastlight-final/README.md) (start with its README).

# Film app: session log

Format as in `docs/log.md`: done / in progress / blocked.

## 2026-11-14 : Yassine + Claude Code, 3D film app and video
- **Done**: `web/` = one continuous 3D film on real NASA terrain (Moon, south pole with the 9 regions, Athena, ground view with data-driven Sun and Earth, crash test with ghost landers, verdict with CSV), an AI copilot that flies it (whitelisted actions, no numbers from the model), "Explain" briefs with every number verified. `video/` = 30 s Remotion film from real captures, ElevenLabs voice, original score, subtitles. 30 unit tests. Accepts both shapes of the data contract (v1 and the team's v2).
- **In progress**: nothing.
- **Blocked**: real pipeline data (everything is mock); pins still use mock positions, not Adam's digitized ones.
