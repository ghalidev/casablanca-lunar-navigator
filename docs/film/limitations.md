> **Archived working notes (14–15 Nov), superseded.** They describe drafts and the first prototype and may contradict the final submission. The final submission, with its current results, validation and limits, is [`lastlight-final/`](../../lastlight-final/README.md) (start with its README).

# Film app: known limitations

- **Mock data.** Sun, Earth, survival and top-10 files are the contract mock until the pipeline delivers; the "Mock data" banner stays visible and no number may be quoted.
- **The 3D skyline is not the computed horizon.** It comes from the coarse global LOLA grid (about 1.9 km/px) with relief x2.5. The "Sun hidden / visible" readout comes from the series file. On mock data the two can disagree; with real horizons the readout is the reference.
- **Region pins use the mock `sites.json` positions**, which are placeholders. Adam's digitized positions (`public/data/sites.json` at repo level, assumption A7) are not wired into `web/` yet.
- **Athena marker** is illustrative (see F6): touchdown from a secondary source, intended site from LROC, about 0.4 km apart.
- **No thermal model**, as in the rest of the project: a lander dies when its battery is empty.
- **Copilot and explanations need `GROQ_API_KEY`.** Without it the copilot reports itself offline and "Explain" shows a fixed sentence. They can mis-pick a whitelisted action; they cannot produce a number.
- **Browser support.** WebGL2 and a recent GPU are needed for 60 fps; the first dive compiles shaders (a short freeze is mitigated with `compileAsync`). Voice input uses the browser's Web Speech API (not in every browser).
- **Phones.** Layout was checked in desktop browsers and in phone-sized windows for some shots, not on real devices.
- **Dead CSS** from the removed multi-page views remains in `web/src/index.css`.
