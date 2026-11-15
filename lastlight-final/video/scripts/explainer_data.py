"""Real data for the explainer video, read from the pipeline output (web/public/data). Writes video/public/explainer.json."""
import json, math, os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
D = os.path.join(ROOT, 'web', 'public', 'data')
sites = json.load(open(os.path.join(D, 'sites.json')))['sites']
mal = next(s for s in sites if s['id'] == 'malapert-massif')
ser = json.load(open(os.path.join(D, 'series', 'malapert-massif_2027.json')))
sun_el, sun_az, sun_frac = ser['sun_el'], ser['sun_az'], ser['sun_frac']
n = len(sun_el)
# one lunar day (~29.5 Earth days): the Sun goes once around the horizon. Start where it is up.
day = next(d for d in range(250, 330) if sun_frac[d * 24] >= 0.9)
circle = [{'az': sun_az[i], 'el': sun_el[i], 'frac': sun_frac[i]} for i in range(day * 24, min(n, day * 24 + 709), 6)]
# a ridge cuts the Sun: in view, hidden half a day later while still well above the flat horizon.
# Malapert (a peak) never shows this in 2027; Nobile Rim 2 does: take its highest-Sun case.
rid_site = next(s for s in sites if s['id'] == 'nobile-rim-2')
rs = json.load(open(os.path.join(D, 'series', 'nobile-rim-2_2027.json')))
ev = [i for i in range(len(rs['sun_el']) - 12) if rs['sun_frac'][i] >= 0.95 and rs['sun_frac'][i + 12] <= 0.05 and rs['sun_el'][i + 12] > 0.3]
cut = max(ev, key=lambda i: rs['sun_el'][i + 12])
ridge = [{'az': rs['sun_az'][i], 'el': rs['sun_el'][i], 'frac': rs['sun_frac'][i]} for i in range(cut - 24, cut + 37)]
ridge_skyline = rid_site['horizon']['mast_2m']
# best landing day of each region, 2027-2030
best = []
for s in sites:
    f = json.load(open(os.path.join(D, 'survival', f"{s['id']}.json")))
    b = max(f['windows'], key=lambda w: w['p_survive_14d'])
    best.append({'id': s['id'], 'name': s['name'], 'p': b['p_survive_14d'], 'date': b['landing_utc'][:10], 'lat': s['lat'], 'lon': s['lon']})
best.sort(key=lambda r: -r['p'])
# landing-error simulation of Malapert's 2027 sample day, and the terrain slope grid under it
surv = json.load(open(os.path.join(D, 'survival', 'malapert-massif.json')))
grid = json.load(open(os.path.join(D, 'ghosts', 'malapert-massif_grid.json')))
landers = [[round(g['dx_m']), round(g['dy_m']), g['died_at_h']] for g in surv['ghost_landers_sample']]
out = {
    'source': 'web/public/data, params_ref ' + surv['params_ref'],
    'skyline': mal['horizon']['mast_2m'],
    'circle_day': f"2027 day {day}", 'circle': circle,
    'ridge_site': 'Nobile Rim 2', 'ridge_utc_hour': cut, 'ridge': ridge, 'ridge_skyline': ridge_skyline,
    'best': best,
    'landers_day': surv['ghost_window_utc'][:10], 'landers': landers,
    'slope': {'nx': grid['nx'], 'step_m': grid['grid_step_m'], 'half_m': grid['grid_half_m'], 'deg': [round(v, 1) for v in grid['slope_deg']]},
    'n_draws': surv['windows'][0]['n_draws'], 'n_days': len(surv['windows']), 'n_sites': len(sites),
}
json.dump(out, open(os.path.join(ROOT, 'video', 'public', 'explainer.json'), 'w'), separators=(',', ':'))
alive = sum(1 for l in landers if l[2] is None)
print('circle day', day, 'ridge hour', cut, 'el', rs['sun_el'][cut + 12], 'alive', alive, 'of', len(landers), 'best', [(b['name'], b['p']) for b in best][:3])
