import type { Site, SiteMetrics } from '../../types';
import { METRIC_DEFS, formatMetric } from '../cards/MetricCards';

const LOWER_IS_BETTER: Array<keyof SiteMetrics> = ['longestDarkH', 'longestCommGapH'];

export interface CompareRow {
  site: Site;
  metrics: SiteMetrics;
}

export function CompareTable({ rows }: { rows: CompareRow[] }) {
  if (rows.length < 2) {
    return <div className="empty">Tick at least two sites in the list to compare them side by side.</div>;
  }
  return (
    <div className="table-wrap">
      <table className="compare">
        <thead>
          <tr>
            <th />
            {rows.map((r) => (
              <th key={r.site.id}>{r.site.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRIC_DEFS.map((d) => {
            const values = rows.map((r) => r.metrics[d.key]);
            const lower = LOWER_IS_BETTER.includes(d.key);
            const best = lower ? Math.min(...values) : Math.max(...values);
            const allEqual = values.every((v) => Math.abs(v - values[0]) < 1e-9);
            return (
              <tr key={d.key}>
                <th scope="row">
                  {d.label} <span className="muted">({d.unit}{lower ? ', lower is better' : ''})</span>
                </th>
                {values.map((v, i) => (
                  <td key={rows[i].site.id} className={`mono ${!allEqual && Math.abs(v - best) < 1e-9 ? 'best' : ''}`}>
                    {formatMetric(d.key, v)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
