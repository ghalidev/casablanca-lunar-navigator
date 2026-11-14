# LASTLIGHT

**Choose where and when your lander survives the lunar south pole.**

NASA Space Apps Challenge 2026 — *Lunar Landing Site Navigator* — team "Casablanca, We Have A Solution".

| Folder | What | Owner |
|---|---|---|
| `pipeline/` | Python 3.11 science: horizons from LOLA DEM, Sun/Earth via SPICE, Monte Carlo survival | science |
| `web/` | Vite + React + TS app (three.js, D3) | Redouane |
| `video/` | Remotion 30 s video | Redouane + Claude |
| `contracts/` | Shared JSON schema + mock data | both (reviewed PR) |
| `docs/` | Assumptions, limitations, data sources, submission texts | all |

Project brief and rules: [`CLAUDE.md`](CLAUDE.md). Data contract: [`contracts/README.md`](contracts/README.md).

```bash
pip install jsonschema
python contracts/validate.py contracts/mock
```
