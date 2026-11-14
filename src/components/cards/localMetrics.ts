// Temporary local metrics until Yasin's src/lib/metrics.ts (computeMetrics) lands.
// Same definitions as SiteMetrics in src/types.ts.
import type { Sample, SiteMetrics } from '../../types';

export type SampleState = 'both' | 'sun' | 'earth' | 'dark';

export const isSunlit = (s: Sample) => s.sunFrac > 0.5;

export function sampleState(s: Sample): SampleState {
  const sun = isSunlit(s);
  if (sun && s.earthVisible) return 'both';
  if (sun) return 'sun';
  if (s.earthVisible) return 'earth';
  return 'dark';
}

function longestRun(samples: Sample[], pred: (s: Sample) => boolean): number {
  let best = 0;
  let cur = 0;
  for (const s of samples) {
    cur = pred(s) ? cur + 1 : 0;
    if (cur > best) best = cur;
  }
  return best;
}

export function computeMetricsLocal(samples: Sample[], stepMin: number): SiteMetrics {
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
    // vertical panel always facing the Sun's azimuth: power fraction = visible disc * cos(elevation)
    energy += s.sunFrac * Math.cos((s.sunEl * Math.PI) / 180) * stepH;
  }
  return {
    illumPct: (100 * lit) / n,
    longestDarkH: longestRun(samples, (s) => !isSunlit(s)) * stepH,
    earthVisPct: (100 * earth) / n,
    longestCommGapH: longestRun(samples, (s) => !s.earthVisible) * stepH,
    bothPct: (100 * both) / n,
    energyKWhPerKW: energy,
  };
}
