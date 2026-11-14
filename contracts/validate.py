"""Validate a LASTLIGHT data folder against contracts/schema.json.

Usage:
  python contracts/validate.py contracts/mock
  python contracts/validate.py web/public/data

Checks the JSON Schema, then the cross-file rules the schema cannot express:
array lengths == n, file names match site_id, the ghost sample points at an
existing window, top10 ranks are 1..k, and the mock flag is consistent.
Exit code 0 = OK, 1 = errors (printed). Requires: pip install jsonschema
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

SCHEMA = json.loads((Path(__file__).resolve().parent / "schema.json").read_text())
SERIES_KEYS = ["sun_el", "sun_az", "earth_el", "earth_az", "sun_frac", "earth_frac", "irradiance_wm2"]
errors: list[str] = []


def check(path: Path, def_name: str) -> dict | None:
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as e:
        errors.append(f"{path}: cannot read JSON ({e})")
        return None
    v = Draft202012Validator({"$ref": f"#/$defs/{def_name}", "$defs": SCHEMA["$defs"]})
    for err in sorted(v.iter_errors(data), key=lambda e: list(e.path))[:20]:
        loc = "/".join(str(p) for p in err.path) or "<root>"
        errors.append(f"{path}: {loc}: {err.message[:200]}")
    return data


def main(root: Path) -> int:
    mocks: dict[str, bool] = {}
    sites = check(root / "sites.json", "sites_file")
    if sites:
        mocks["sites.json"] = sites.get("mock")
        ids = [s.get("id") for s in sites.get("sites", [])]
        if len(ids) != len(set(ids)):
            errors.append("sites.json: duplicate site ids")

    for p in sorted((root / "series").glob("*.json")):
        d = check(p, "series_file")
        if not d:
            continue
        mocks[str(p.relative_to(root))] = d.get("mock")
        m = re.fullmatch(r"(.+)_(\d{4})\.json", p.name)
        if not m or m.group(1) != d.get("site_id") or not str(d.get("t0", "")).startswith(m.group(2)):
            errors.append(f"{p}: file name must be {{site_id}}_{{year}}.json matching site_id and t0")
        for k in SERIES_KEYS:
            if len(d.get(k, [])) != d.get("n"):
                errors.append(f"{p}: len({k}) = {len(d.get(k, []))} != n = {d.get('n')}")

    for p in sorted((root / "survival").glob("*.json")):
        d = check(p, "survival_file")
        if not d:
            continue
        mocks[str(p.relative_to(root))] = d.get("mock")
        if p.stem != d.get("site_id"):
            errors.append(f"{p}: file name must be {{site_id}}.json")
        times = [w["landing_utc"] for w in d.get("windows", [])]
        if times != sorted(times):
            errors.append(f"{p}: windows must be sorted by landing_utc")
        g = d.get("ghost_landers_sample", {}).get("landing_utc")
        if g not in set(times):
            errors.append(f"{p}: ghost_landers_sample.landing_utc {g} not in windows")

    top = check(root / "top10.json", "top10_file")
    if top:
        mocks["top10.json"] = top.get("mock")
        ranks = [w.get("rank") for w in top.get("windows", [])]
        if ranks != list(range(1, len(ranks) + 1)):
            errors.append(f"top10.json: ranks must be 1..{len(ranks)} in order, got {ranks}")
        thr = top.get("criteria", {}).get("p_threshold", 0)
        for w in top.get("windows", []):
            if w.get("p_survive_14d", 0) < thr:
                errors.append(f"top10.json: rank {w.get('rank')} below p_threshold")

    if len(set(mocks.values())) > 1:
        errors.append(f"mixed mock flags: {mocks}")

    for e in errors:
        print("ERROR", e)
    n_files = len(mocks)
    print(f"{'FAIL' if errors else 'OK'}: {n_files} files checked in {root}, {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.exit(main(Path(sys.argv[1])))
