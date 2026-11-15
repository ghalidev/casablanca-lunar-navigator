// Site metrics from a Sun/Earth time series (see SiteMetrics in src/types.ts).
import type { ComputeMetrics, Sample } from '../types';

export type SampleState = 'both' | 'sun' | 'earth' | 'dark';

/** Sunlit = more than half of the solar disc above the local horizon. */
export const isSunlit = (s: Sample) => s.sunFrac > 0.5;

export function sampleState(s: Sample): SampleState {
  const sun = isSunlit(s);
  if (sun && s.earthVisible) return 'both';
  if (sun) return 'sun';
  if (s.earthVisible) return 'earth';
  return 'dark';
}

/** Longest run of consecutive samples (from index a to b, exclusive) matching pred. */
export function longestRun(samples: Sample[], pred: (s: Sample) => boolean, a = 0, b = samples.length): number {
  let best = 0;
  let cur = 0;
  for (let i = a; i < b; i++) {
    cur = pred(samples[i]) ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

/** Power fraction of a vertical panel facing the Sun's azimuth: visible disc x cos(elevation). */
export const panelFraction = (s: Sample) => s.sunFrac * Math.cos((s.sunEl * Math.PI) / 180);

export const computeMetrics: ComputeMetrics = (samples, stepMin) => {
  const n = samples.length || 1;
  const stepH = stepMin / 60;
  let lit = 0;
  let earth = 0;
  let both = 0;
  let energy = 0;
  for (const s of samples) {
    const sun = isSunlit(s);
    if (sun) lit++;
    if (s.earthVisible) earth++;
    if (sun && s.earthVisible) both++;
    energy += panelFraction(s) * stepH;
  }
  return {
    illumPct: (100 * lit) / n,
    longestDarkH: longestRun(samples, (s) => !isSunlit(s)) * stepH,
    earthVisPct: (100 * earth) / n,
    longestCommGapH: longestRun(samples, (s) => !s.earthVisible) * stepH,
    bothPct: (100 * both) / n,
    energyKWhPerKW: energy,
  };
};
