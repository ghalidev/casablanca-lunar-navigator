import type { SiteMetrics } from '../../types';
import type { Mode } from '../../state/store';

interface CardDef {
  key: keyof SiteMetrics;
  label: string;
  unit: string;
  tone: 'sun' | 'earth' | 'both' | 'neutral';
  planner: (v: number) => string;
  explore: (v: number) => string;
}

export const METRIC_DEFS: CardDef[] = [
  {
    key: 'illumPct',
    label: 'Sunlight',
    unit: '%',
    tone: 'sun',
    planner: () => 'Share of time with more than half the solar disc above the horizon.',
    explore: (v) => `The solar panels get sunlight ${v.toFixed(0)}% of the time.`,
  },
  {
    key: 'longestDarkH',
    label: 'Longest darkness',
    unit: 'h',
    tone: 'neutral',
    planner: () => 'Longest continuous period without sunlight: the battery must survive this.',
    explore: (v) =>
      v === 0 ? 'The Sun never fully sets here in this period.' : `The battery must keep the lander alive for ${v.toFixed(0)} hours of night.`,
  },
  {
    key: 'earthVisPct',
    label: 'Earth in view',
    unit: '%',
    tone: 'earth',
    planner: () => 'Share of time Earth is above the horizon (+0.5° margin): direct-to-Earth radio possible.',
    explore: (v) => `The lander can phone home ${v.toFixed(0)}% of the time.`,
  },
  {
    key: 'longestCommGapH',
    label: 'Longest comms gap',
    unit: 'h',
    tone: 'neutral',
    planner: () => 'Longest continuous period with Earth below the horizon.',
    explore: (v) => `Longest silence with Earth: ${v.toFixed(0)} hours.`,
  },
  {
    key: 'bothPct',
    label: 'Sun + Earth',
    unit: '%',
    tone: 'both',
    planner: () => 'Share of time with both power and direct-to-Earth comms: ideal operations.',
    explore: (v) => `Power and a phone line at the same time: ${v.toFixed(0)}% of the time.`,
  },
  {
    key: 'energyKWhPerKW',
    label: 'Energy',
    unit: 'kWh/kW',
    tone: 'sun',
    planner: () => 'Energy per 1 kW of vertical, sun-tracking panel over the selected period.',
    explore: (v) => `A 1 kW solar panel would collect about ${v.toFixed(0)} kWh here.`,
  },
];

export function formatMetric(key: keyof SiteMetrics, v: number): string {
  if (key === 'energyKWhPerKW' || key === 'longestDarkH' || key === 'longestCommGapH') return v.toFixed(0);
  return v.toFixed(1);
}

export function MetricCards({ metrics, mode }: { metrics: SiteMetrics; mode: Mode }) {
  return (
    <div className="cards">
      {METRIC_DEFS.map((d) => {
        const v = metrics[d.key];
        return (
          <div key={d.key} className={`card tone-${d.tone}`}>
            <div className="card-label">{d.label}</div>
            <div className="card-value mono">
              {formatMetric(d.key, v)}
              <span className="card-unit">{d.unit}</span>
            </div>
            <div className="card-sub">{mode === 'explore' ? d.explore(v) : d.planner(v)}</div>
          </div>
        );
      })}
    </div>
  );
}
