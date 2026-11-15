#!/usr/bin/env python3
"""Validate a data folder (contracts/mock or web/public/data) against schema.json.

Usage:  python3 contracts/validate.py contracts/mock
Needs:  pip install jsonschema   (>= 4.18 for draft 2020-12)
Also checks what JSON Schema cannot: equal array lengths in series files,
file names matching site ids, and that every site has its files.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

HERE = Path(__file__).parent
SCHEMA = json.loads((HERE / "schema.json").read_text())
REGISTRY = Registry().with_resource(SCHEMA["$id"], Resource.from_contents(SCHEMA))
SERIES_KEYS = ("sun_el", "sun_az", "earth_el", "earth_az", "sun_frac", "earth_frac", "irradiance_wm2")


def validator(defname: str) -> Draft202012Validator:
    return Draft202012Validator({"$ref": f"{SCHEMA['$id']}#/$defs/{defname}"}, registry=REGISTRY)


def check(path: Path, defname: str, errors: list[str]) -> dict | None:
    if not path.exists():
        errors.append(f"missing: {path}")
        return None
    data = json.loads(path.read_text())
    for e in validator(defname).iter_errors(data):
        loc = "/".join(map(str, e.absolute_path)) or "<root>"
        errors.append(f"{path.name}: {loc}: {e.message[:200]}")
    return data


def main(folder: str) -> int:
    root = Path(folder)
    errors: list[str] = []
    mock_flags = []

    sites = check(root / "sites.json", "sites_file", errors)
    if sites:
        mock_flags.append(sites.get("mock"))
        ids = [s["id"] for s in sites["sites"]]
        if len(set(ids)) != len(ids):
            errors.append("sites.json: duplicate site ids")
        for sid in ids:
            series_files = sorted((root / "series").glob(f"{sid}_*.json"))
            if not series_files:
                errors.append(f"no series file for {sid}")
            for sp in series_files:
                ser = check(sp, "series_file", errors)
                if ser:
                    mock_flags.append(ser.get("mock"))
                    if ser["site_id"] != sid:
                        errors.append(f"{sp.name}: site_id {ser['site_id']} != {sid}")
                    lens = {k: len(ser[k]) for k in SERIES_KEYS}
                    if len(set(lens.values())) != 1:
                        errors.append(f"{sp.name}: array lengths differ {lens}")
            surv = check(root / "survival" / f"{sid}.json", "survival_file", errors)
            if surv:
                mock_flags.append(surv.get("mock"))
                if surv["site_id"] != sid:
                    errors.append(f"survival/{sid}.json: site_id mismatch")

    top = check(root / "top10.json", "top10_file", errors)
    if top:
        mock_flags.append(top.get("mock"))
        ranks = [w["rank"] for w in top["windows"]]
        if ranks != list(range(1, len(ranks) + 1)):
            errors.append(f"top10.json: ranks not 1..n: {ranks}")

    for e in errors:
        print("ERROR", e)
    state = "MOCK" if any(mock_flags) else "REAL"
    print(f"{root}: {len(errors)} error(s); data is {state}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else str(HERE / "mock")))
