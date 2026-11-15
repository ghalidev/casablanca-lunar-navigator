"""Turn the per-site results into the contract files in web/public/data (see contracts/schema.json)."""
import json
import os
from datetime import datetime, timezone

import config as C


def _dump(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))


def top_windows(results, min_gap_days=29):
    """Best windows over all sites: >= threshold, ranked by probability then slip tolerance.

    Neighbouring days of one site are near-duplicates, so a site's windows are at least `min_gap_days` apart
    (about one lunar day), keeping the strongest of each cluster.
    """
    cands = []
    for r in results:
        sid = r["site"]["id"]
        for w in r["survival"]["windows"]:
            cands.append({**w, "site_id": sid})
    cands.sort(key=lambda w: (-w["p_survive_14d"], -w["slip_tolerance_days"], w["landing_utc"], w["site_id"]))
    chosen = []
    for w in cands:
        if w["p_survive_14d"] < C.P_THRESHOLD:
            break
        day = datetime.fromisoformat(w["landing_utc"].replace("Z", "+00:00"))
        if any(c["site_id"] == w["site_id"] and abs((datetime.fromisoformat(c["landing_utc"].replace("Z", "+00:00")) - day).days) < min_gap_days for c in chosen):
            continue
        chosen.append(w)
        if len(chosen) == C.TOP_N:
            break
    return [{"rank": i + 1, **w} for i, w in enumerate(chosen)]


def write_all(results, out_dir):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    order = {sid: i for i, sid in enumerate(C.SITE_IDS)}
    results = sorted(results, key=lambda r: order[r["site"]["id"]])
    _dump(os.path.join(out_dir, "sites.json"), {"generated_at": now, "mock": False, "params_ref": C.PARAMS_REF, "sites": [r["site"] for r in results]})
    for r in results:
        sid = r["site"]["id"]
        _dump(os.path.join(out_dir, "series", f"{sid}_{C.SERIES_YEAR}.json"), r["series"])
        _dump(os.path.join(out_dir, "survival", f"{sid}.json"), r["survival"])
    top = top_windows(results)
    y0, y1 = C.SURVIVAL_YEARS
    _dump(os.path.join(out_dir, "top10.json"), {
        "generated_at": now, "mock": False, "params_ref": C.PARAMS_REF,
        "criteria": {"survive_days": C.SURVIVE_DAYS, "p_threshold": C.P_THRESHOLD, "year_start": y0, "year_end": y1,
                     "ranking": "p_survive_14d desc, then slip_tolerance_days desc"},
        "windows": top,
    })
