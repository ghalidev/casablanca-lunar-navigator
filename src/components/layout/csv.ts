import type { Sample, Site, SiteMetrics } from '../../types';
import type { CompareRow } from '../compare/CompareTable';
import { METRIC_DEFS } from '../cards/MetricCards';
import { sampleState } from '../cards/localMetrics';

const cell = (v: string | number | boolean) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (rows: Array<Array<string | number | boolean>>) => rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

const COLUMN: Record<keyof SiteMetrics, string> = {
  illumPct: 'sunlight_pct',
  longestDarkH: 'longest_darkness_h',
  earthVisPct: 'earth_in_view_pct',
  longestCommGapH: 'longest_comms_gap_h',
  bothPct: 'sun_and_earth_pct',
  energyKWhPerKW: 'energy_kwh_per_kw',
};

/** One row per time step: what the site sees. */
export function trackCsv(site: Site, samples: Sample[]): string {
  const rows: Array<Array<string | number | boolean>> = [
    ['utc', 'sun_az_deg', 'sun_el_deg', 'sun_visible_fraction', 'earth_az_deg', 'earth_el_deg', 'earth_visible', 'state', 'site_id', 'site_lat', 'site_lon'],
  ];
  for (const s of samples) {
    rows.push([s.t, r4(s.sunAz), r4(s.sunEl), r4(s.sunFrac), r4(s.earthAz), r4(s.earthEl), s.earthVisible, sampleState(s), site.id, site.lat, site.lon]);
  }
  return toCsv(rows);
}

/** One row per site: the summary metrics shown in the Compare tab. */
export function compareCsv(rows: CompareRow[], startISO: string, endISO: string): string {
  const out: Array<Array<string | number | boolean>> = [
    ['site_id', 'site_name', 'lat', 'lon', 'from_utc', 'to_utc', ...METRIC_DEFS.map((d) => COLUMN[d.key])],
  ];
  for (const r of rows) {
    out.push([r.site.id, r.site.name, r.site.lat, r.site.lon, startISO, endISO, ...METRIC_DEFS.map((d) => r4(r.metrics[d.key]))]);
  }
  return toCsv(out);
}

export function downloadTrack(site: Site, samples: Sample[], startDate: string, endDate: string) {
  download(`lastlight_${site.id}_${startDate}_${endDate}.csv`, trackCsv(site, samples));
}

export function downloadCompare(rows: CompareRow[], startISO: string, endISO: string) {
  download(`lastlight_compare_${startISO.slice(0, 10)}_${endISO.slice(0, 10)}.csv`, compareCsv(rows, startISO, endISO));
}
