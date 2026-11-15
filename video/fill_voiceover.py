#!/usr/bin/env python3
"""Fill the video voice-over placeholders from pipeline output.

Reads web/public/data/top10.json + sites.json (or another folder with --data),
replaces {{N_DRAWS}}, {{TOP1_SITE}}, {{TOP1_DATE}}, {{TOP1_P_SURVIVE}} in the
ElevenLabs block of docs/video-script.md, and prints two versions:
  1. the text to paste into ElevenLabs (numbers spelled out in words),
  2. the subtitle text (digits).
Refuses to run on mock data unless --allow-mock is given (then marks the output).

Usage: python3 video/fill_voiceover.py [--data web/public/data] [--allow-mock]
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
ORD = {1: "first", 2: "second", 3: "third", 5: "fifth", 8: "eighth", 9: "ninth", 12: "twelfth"}


def words(n: int) -> str:
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else "-" + ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + words(n % 100))
    if n < 1_000_000:
        return words(n // 1000) + " thousand" + ("" if n % 1000 == 0 else " " + words(n % 1000))
    raise ValueError(n)


def ordinal(n: int) -> str:
    if n in ORD:
        return ORD[n]
    if n < 20:
        return ONES[n] + "th"
    t, o = divmod(n, 10)
    if o == 0:
        return TENS[t][:-1] + "ieth"
    return TENS[t] + "-" + (ORD.get(o) or ONES[o] + "th")


def year_words(y: int) -> str:
    return f"{words(y // 100)} {words(y % 100)}"  # 2028 -> twenty twenty-eight


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(ROOT / "web/public/data"))
    ap.add_argument("--allow-mock", action="store_true")
    a = ap.parse_args()
    data = Path(a.data)
    missing = [f for f in ("top10.json", "sites.json") if not (data / f).exists()]
    if missing:
        raise SystemExit(
            f"No pipeline results yet: {', '.join(missing)} not found in {data}.\n"
            "The science pipeline has to publish its output there first (a 'data: …' PR).\n"
            "For a rehearsal with fake numbers: python3 video/fill_voiceover.py --data contracts/mock --allow-mock"
        )
    top = json.loads((data / "top10.json").read_text())
    sites = {s["id"]: s["name"] for s in json.loads((data / "sites.json").read_text())["sites"]}
    if top.get("mock") and not a.allow_mock:
        raise SystemExit("top10.json is MOCK data. Wait for the pipeline, or pass --allow-mock for a rehearsal.")

    w = top["windows"][0]
    d = datetime.fromisoformat(w["landing_utc"].replace("Z", "+00:00"))
    n = int(w.get("n_draws") or 0)
    if not n:
        raise SystemExit("top10.json windows[0].n_draws is missing.")
    p = round(w["p_survive_14d"] * 100)
    site = sites[w["site_id"]]

    spoken = {
        "N_DRAWS": words(n),
        "TOP1_SITE": site,
        "TOP1_DATE": f"{d.strftime('%B')} {ordinal(d.day)}, {year_words(d.year)}",
        "TOP1_P_SURVIVE": f"{words(p)} percent",
    }
    digits = {
        "N_DRAWS": f"{n:,}",
        "TOP1_SITE": site,
        "TOP1_DATE": f"{d.day} {d.strftime('%B')} {d.year}",
        "TOP1_P_SURVIVE": f"{p}%",
    }

    script = (ROOT / "docs/video-script.md").read_text()
    block = script.split("The block with placeholders:")[1].split("```")[1].strip("\n")
    def fill(m: dict[str, str]):
        def run(t: str) -> str:
            out = re.sub(r"\{\{(\w+)\}\}", lambda x: m[x.group(1)], t)
            return "\n".join(line[:1].upper() + line[1:] for line in out.split("\n"))
        return run
    tag = "  [MOCK REHEARSAL — do not publish]" if top.get("mock") else ""

    print(f"# Source: {data / 'top10.json'}  params_ref={top.get('params_ref')}{tag}\n")
    print("=== Paste into ElevenLabs ===\n")
    print(fill(spoken)(block))
    print("\n=== Subtitles ===\n")
    print(fill(digits)(block))
    words_count = len(fill(spoken)(block).split())
    print(f"\n# {words_count} spoken words" + ("  (over 60: trim before recording)" if words_count > 60 else ""))


if __name__ == "__main__":
    main()
