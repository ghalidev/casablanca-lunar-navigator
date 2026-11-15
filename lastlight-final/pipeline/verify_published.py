"""Check the published survival numbers in 1 second, without the DEM or Modal.

    python3 pipeline/verify_published.py

1. Reads the shipped survival files (web/public/data/survival/*.json) and prints the headline window
   (Malapert Massif, 15 Oct 2029) with its 95% statistical interval (Wilson, n = 1,000 draws).
2. Counts the simulated landings behind the site: draws x landing days x regions.
3. Recounts, from the per-day death hours the pipeline wrote (web/public/data/ghosts/*.bin, 2027), how many of
   the 1,000 landers survive each day, and checks it equals p_survive_14d in the survival file.

To recompute everything from NASA data instead: `modal run pipeline/app.py` (horizons + survival, all regions,
2027-2030), `modal run pipeline/app.py::ghosts`, `modal run pipeline/app.py::sensitivity`. Parameters:
pipeline/config.py. Core physics tests: `python3 -m pytest pipeline/test_core.py`.
"""
import json
import math
import struct
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "web" / "public" / "data"


def wilson(k: int, n: int, z: float = 1.96):
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return c - h, c + h


def main():
    files = sorted((DATA / "survival").glob("*.json"))
    total = 0
    refs = set()
    for f in files:
        s = json.loads(f.read_text())
        refs.add(s["params_ref"])
        total += sum(w.get("n_draws", 1000) for w in s["windows"])
    print(f"{len(files)} regions, {total:,} simulated landings, params_ref {sorted(refs)}")

    m = json.loads((DATA / "survival" / "malapert-massif.json").read_text())
    w = next(x for x in m["windows"] if x["landing_utc"].startswith("2029-10-15"))
    n = w.get("n_draws", 1000)
    k = round(w["p_survive_14d"] * n)
    lo, hi = wilson(k, n)
    print(f"Malapert Massif, landing 2029-10-15: {k}/{n} alive after 14 days = {k / n:.1%} "
          f"(95% interval {lo:.1%} to {hi:.1%}, sampling only)")

    checked = 0
    for f in files:
        sid = f.stem
        b = DATA / "ghosts" / f"{sid}_2027.bin"
        if not b.exists():
            continue
        raw = b.read_bytes()
        deaths = struct.unpack(f"<{len(raw) // 2}H", raw)
        s = json.loads(f.read_text())
        days = [x for x in s["windows"] if x["landing_utc"].startswith("2027")]
        nd = len(deaths) // len(days)
        for i, x in enumerate(days):
            alive = sum(1 for v in deaths[i * nd:(i + 1) * nd] if v == 0xFFFF)
            assert abs(alive / nd - x["p_survive_14d"]) < 1e-9, (sid, x["landing_utc"], alive)
            checked += 1
    print(f"ghost replay: survivors recounted from per-landing death hours = p_survive_14d on {checked} region-days (2027)")


if __name__ == "__main__":
    main()
