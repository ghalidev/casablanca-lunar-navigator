// Best landing windows: slide a mission of N days over a search period and rank the start dates.
import type { FindBestWindows, MissionWindow, Sample, Site } from '../types';
import { computeTrack } from './ephemeris';
import { isSunlit, longestRun, panelFraction } from './metrics';

export const WINDOW_STEP_MIN = 120; // sample every 2 h (keeps a 6-month search for 9 sites around 1-2 s)
export const START_STEP_H = 6; // candidate landing every 6 h

/**
 * Score (higher is better), documented in docs/assumptions.md:
 *   sunlight % + 0.5 x Earth-in-view % - 2 x longest darkness (h)
 * Power first (a lander dies in the dark), then direct-to-Earth comms; long nights are penalised hard.
 */
export function windowScore(illumPct: number, earthVisPct: number, longestDarkH: number): number {
  return illumPct + 0.5 * earthVisPct - 2 * longestDarkH;
}

/** Rank every candidate start, from a precomputed track sampled every WINDOW_STEP_MIN. */
export function rankWindows(track: Sample[], durationDays: number): MissionWindow[] {
  const stepH = WINDOW_STEP_MIN / 60;
  const len = Math.round((durationDays * 24) / stepH);
  const startEvery = Math.max(1, Math.round(START_STEP_H / stepH));
  if (track.length < len + 1) return [];

  // prefix sums: O(1) per window for the percentages and the energy
  const n = track.length;
  const lit = new Float64Array(n + 1);
  const earth = new Float64Array(n + 1);
  const both = new Float64Array(n + 1);
  const energy = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const s = track[i];
    const sun = isSunlit(s) ? 1 : 0;
    const e = s.earthVisible ? 1 : 0;
    lit[i + 1] = lit[i] + sun;
    earth[i + 1] = earth[i] + e;
    both[i + 1] = both[i] + sun * e;
    energy[i + 1] = energy[i] + panelFraction(s) * stepH;
  }

  const out: MissionWindow[] = [];
  for (let a = 0; a + len <= n; a += startEvery) {
    const b = a + len;
    const illumPct = (100 * (lit[b] - lit[a])) / len;
    const earthVisPct = (100 * (earth[b] - earth[a])) / len;
    const longestDarkH = longestRun(track, (s) => !isSunlit(s), a, b) * stepH;
    const metrics = {
      illumPct,
      longestDarkH,
      earthVisPct,
      longestCommGapH: longestRun(track, (s) => !s.earthVisible, a, b) * stepH,
      bothPct: (100 * (both[b] - both[a])) / len,
      energyKWhPerKW: energy[b] - energy[a],
    };
    out.push({
      start: track[a].t,
      end: new Date(Date.parse(track[a].t) + durationDays * 86_400_000).toISOString(),
      score: windowScore(illumPct, earthVisPct, longestDarkH),
      metrics,
    });
  }
  return out;
}

/** Higher score first; ties (common on a flat horizon) broken by energy collected. */
export const byScore = (x: MissionWindow, y: MissionWindow) => y.score - x.score || y.metrics.energyKWhPerKW - x.metrics.energyKWhPerKW;

/** Keep the best windows that do not overlap each other. */
export function pickNonOverlapping<T extends MissionWindow>(sorted: T[], count: number): T[] {
  const picked: T[] = [];
  for (const w of sorted) {
    if (picked.length >= count) break;
    const a = Date.parse(w.start);
    const b = Date.parse(w.end);
    if (picked.every((p) => b <= Date.parse(p.start) || a >= Date.parse(p.end))) picked.push(w);
  }
  return picked;
}

export const findBestWindows: FindBestWindows = (site, fromISO, toISO, durationDays) => {
  const endISO = new Date(Date.parse(toISO) + durationDays * 86_400_000).toISOString();
  const track = computeTrack(site, fromISO, endISO, WINDOW_STEP_MIN);
  const all = rankWindows(track, durationDays).filter((w) => Date.parse(w.start) <= Date.parse(toISO));
  all.sort(byScore);
  return pickNonOverlapping(all, 3);
};

export interface RankedWindow extends MissionWindow {
  site: Site;
}

/** Top windows across several sites (non-overlapping per site). */
export function findBestWindowsAcross(sites: Site[], fromISO: string, toISO: string, durationDays: number, perSite = 3, total = 10): RankedWindow[] {
  const all: RankedWindow[] = [];
  for (const site of sites) {
    for (const w of findBestWindows(site, fromISO, toISO, durationDays).slice(0, perSite)) all.push({ ...w, site });
  }
  return all.sort(byScore).slice(0, total);
}
