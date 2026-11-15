// Compare our Sun/Earth azimuth and elevation (src/lib/ephemeris.ts) with NASA JPL Horizons.
// Run from the repo root:  node --experimental-strip-types validation/horizons.mts
// Writes validation/horizons-results.json; the summary goes into docs/validation.md.
import { writeFileSync } from 'node:fs';
import { computeTrack } from '../src/lib/ephemeris.ts';
import type { Site } from '../src/types.ts';

const API = 'https://ssd.jpl.nasa.gov/api/horizons.api';

const SITES: Site[] = [
  { id: 'haworth', name: 'Haworth', lat: -86.77, lon: -22.67, source: 'public/data/sites.json' },
  { id: 'malapert-massif', name: 'Malapert Massif', lat: -86.0, lon: -0.17, source: 'public/data/sites.json' },
  { id: 'de-gerlache-rim-2', name: 'de Gerlache Rim 2', lat: -88.25, lon: -64.18, source: 'public/data/sites.json' },
  { id: 'near-pole', name: 'Near pole (89.45°S, 137.3°W)', lat: -89.45, lon: -137.3, source: 'test point' },
];
const DATES = ['2026-12-01', '2027-06-15', '2028-03-10'];
const BODIES = [
  { key: 'sun', command: '10' },
  { key: 'earth', command: '399' },
] as const;

interface Row {
  t: string;
  az: number;
  el: number;
}

async function horizons(command: string, site: Site, day: string): Promise<Row[]> {
  const p = new URLSearchParams({
    format: 'text',
    COMMAND: `'${command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'OBSERVER'",
    CENTER: "'coord@301'",
    COORD_TYPE: "'GEODETIC'",
    SITE_COORD: `'${site.lon},${site.lat},0'`,
    START_TIME: `'${day} 00:00'`,
    STOP_TIME: `'${nextDay(day)} 00:00'`,
    STEP_SIZE: "'1 h'",
    QUANTITIES: "'4'",
    ANG_FORMAT: "'DEG'",
    CSV_FORMAT: "'YES'",
  });
  const res = await fetch(`${API}?${p}`);
  const text = await res.text();
  const body = text.split('$$SOE')[1]?.split('$$EOE')[0];
  if (!body) throw new Error(`No ephemeris for ${command} at ${site.id} ${day}:\n${text.slice(0, 600)}`);
  return body
    .trim()
    .split('\n')
    .map((line) => {
      const c = line.split(',').map((x) => x.trim());
      const t = new Date(`${c[0].replace(/-(\w{3})-/, ' $1 ')} UTC`).toISOString();
      return { t, az: Number(c[3]), el: Number(c[4]) };
    });
}

function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

const azDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;

const results: Array<Record<string, unknown>> = [];
const all = { sun: { az: [] as number[], el: [] as number[] }, earth: { az: [] as number[], el: [] as number[] } };

for (const site of SITES) {
  for (const day of DATES) {
    const ours = computeTrack(site, `${day}T00:00:00Z`, `${nextDay(day)}T00:00:00Z`, 60);
    const byT = new Map(ours.map((s) => [s.t, s]));
    for (const b of BODIES) {
      const ref = await horizons(b.command, site, day);
      let maxAz = 0;
      let maxEl = 0;
      for (const r of ref) {
        const s = byT.get(r.t);
        if (!s) continue;
        const dAz = azDiff(b.key === 'sun' ? s.sunAz : s.earthAz, r.az);
        const dEl = (b.key === 'sun' ? s.sunEl : s.earthEl) - r.el;
        // azimuth error matters less when looking almost straight up; weight it by cos(el) (= angle on the sky)
        const dAzSky = dAz * Math.cos((r.el * Math.PI) / 180);
        all[b.key].az.push(Math.abs(dAzSky));
        all[b.key].el.push(Math.abs(dEl));
        maxAz = Math.max(maxAz, Math.abs(dAzSky));
        maxEl = Math.max(maxEl, Math.abs(dEl));
      }
      results.push({ site: site.id, lat: site.lat, lon: site.lon, day, body: b.key, n: ref.length, maxAzDeg: maxAz, maxElDeg: maxEl, sample: ref[0] });
      console.log(`${site.id.padEnd(18)} ${day} ${b.key.padEnd(5)} n=${ref.length}  max|dAz|=${maxAz.toFixed(4)}°  max|dEl|=${maxEl.toFixed(4)}°`);
      await new Promise((r) => setTimeout(r, 400)); // be polite to the API
    }
  }
}

const stats = (xs: number[]) => ({ n: xs.length, max: Math.max(...xs), mean: xs.reduce((a, b) => a + b, 0) / xs.length });
const summary = { sun: { az: stats(all.sun.az), el: stats(all.sun.el) }, earth: { az: stats(all.earth.az), el: stats(all.earth.el) } };
console.log(JSON.stringify(summary, null, 2));
writeFileSync('validation/horizons-results.json', JSON.stringify({ generated_utc: new Date().toISOString(), summary, results }, null, 2));
