import type { Site } from '../types';

// Placeholder positions copied from contracts/mock/sites.json.
// They are NOT the official Artemis III region coordinates — the UI shows a MOCK DATA banner
// until Adam's public/data/sites.json (sourced coordinates) exists.
const PLACEHOLDER_SOURCE = 'PLACEHOLDER position (contracts/mock) — not official';

export const PLACEHOLDER_SITES: Site[] = [
  { id: 'peak-near-cabeus-b', name: 'Peak near Cabeus B', lat: -84.9, lon: -45.0 },
  { id: 'haworth', name: 'Haworth', lat: -86.8, lon: -10.0 },
  { id: 'malapert-massif', name: 'Malapert Massif', lat: -85.9, lon: 0.0 },
  { id: 'mons-mouton-plateau', name: 'Mons Mouton Plateau', lat: -85.4, lon: 35.0 },
  { id: 'mons-mouton', name: 'Mons Mouton', lat: -84.6, lon: 30.0 },
  { id: 'nobile-rim-1', name: 'Nobile Rim 1', lat: -85.3, lon: 40.0 },
  { id: 'nobile-rim-2', name: 'Nobile Rim 2', lat: -84.1, lon: 60.0 },
  { id: 'de-gerlache-rim-2', name: 'de Gerlache Rim 2', lat: -88.6, lon: -70.0 },
  { id: 'slater-plain', name: 'Slater Plain', lat: -88.0, lon: 110.0 },
].map((s) => ({ ...s, source: PLACEHOLDER_SOURCE, approximate: true }));

type Raw = Record<string, unknown>;

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

// Accepts both the src/types.ts Site shape and the LASTLIGHT contracts sites_file shape.
function normalize(r: Raw): Site | null {
  const lat = num(r.lat);
  const lon = num(r.lon);
  if (typeof r.id !== 'string' || lat === undefined || lon === undefined) return null;
  let horizon: number[] | undefined;
  if (Array.isArray(r.horizon)) horizon = r.horizon as number[];
  else if (r.horizon && typeof r.horizon === 'object') {
    const h = r.horizon as Raw;
    if (Array.isArray(h.mast_2m)) horizon = h.mast_2m as number[];
  }
  return {
    id: r.id,
    name: typeof r.name === 'string' ? r.name : r.id,
    lat,
    lon,
    heightM: num(r.heightM) ?? num(r.elevation_m),
    source: typeof r.source === 'string' ? r.source : String(r.position_source ?? 'unknown'),
    approximate: r.approximate === true || r.position_source === 'digitized',
    horizon,
  };
}

export async function loadSites(): Promise<{ sites: Site[]; mock: boolean }> {
  try {
    const res = await fetch('/data/sites.json');
    if (res.ok) {
      const json: unknown = await res.json(); // throws on Vite's HTML fallback when the file is missing
      const list = Array.isArray(json) ? json : (json as Raw).sites;
      const mock = !Array.isArray(json) && (json as Raw).mock === true;
      if (Array.isArray(list)) {
        const sites = list.map((x) => normalize(x as Raw)).filter((s): s is Site => s !== null);
        if (sites.length > 0) return { sites, mock };
      }
    }
  } catch {
    // fall through to placeholders
  }
  return { sites: PLACEHOLDER_SITES, mock: true };
}
