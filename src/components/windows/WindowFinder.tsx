import { useState } from 'react';
import { useApp } from '../../state/store';
import { findBestWindowsAcross, type RankedWindow } from '../../lib/windows';
import type { Mode } from '../../state/store';

const DAY_MS = 86_400_000;
const fmt = (iso: string) => iso.slice(0, 16).replace('T', ' ');

export function WindowFinder({ mode }: { mode: Mode }) {
  const { sites, startDate, setFocus, setRange, setTab } = useApp();
  const [days, setDays] = useState(6);
  const [months, setMonths] = useState(6);
  const [from, setFrom] = useState(startDate);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<RankedWindow[] | null>(null);
  const [ms, setMs] = useState(0);

  const run = () => {
    setBusy(true);
    setResults(null);
    // let the "Computing" state paint before the heavy loop
    window.setTimeout(() => {
      const t0 = performance.now();
      const fromISO = `${from}T00:00:00Z`;
      const toISO = new Date(Date.parse(fromISO) + months * 30.44 * DAY_MS).toISOString();
      const real = sites.filter((s) => !s.id.startsWith('custom-'));
      setResults(findBestWindowsAcross(real.length ? real : sites, fromISO, toISO, days));
      setMs(performance.now() - t0);
      setBusy(false);
    }, 30);
  };

  const open = (w: RankedWindow) => {
    setFocus(w.site.id);
    setRange(w.start.slice(0, 10), w.end.slice(0, 10));
    setTab('site');
  };

  return (
    <div className="finder">
      {mode === 'explore' ? (
        <p className="explain">
          A mission needs sunlight for power and a view of Earth to talk home, for every day it stays. Choose how long the
          mission lasts: we try every possible landing date at every site and list the best ones.
        </p>
      ) : (
        <p className="muted small">
          Every start time (every 6 h) at every site is scored: sunlight % + 0.5 x Earth-in-view % - 2 x longest darkness (h).
          Best 3 non-overlapping windows per site, top 10 overall. Samples every 2 h.
        </p>
      )}
      <div className="finder-controls">
        <label>
          Mission length (days)
          <input type="number" min={1} max={28} value={days} onChange={(e) => setDays(Math.min(28, Math.max(1, Number(e.target.value) || 1)))} />
        </label>
        <label>
          Search from
          <input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        </label>
        <label>
          for
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
        </label>
        <button className="btn primary" onClick={run} disabled={busy || sites.length === 0}>
          {busy ? 'Computing…' : 'Find best windows'}
        </button>
      </div>
      <div className="muted small">Artemis III plans a surface stay of about 6 days (George et al., LPSC 2026).</div>

      {results && results.length === 0 && <div className="empty">No complete window fits in this search period.</div>}
      {results && results.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="compare windows">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Site</th>
                  <th>Landing (UTC)</th>
                  <th>Sunlight %</th>
                  <th>Longest dark h</th>
                  <th>Earth %</th>
                  <th>Comms gap h</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {results.map((w, i) => (
                  <tr key={`${w.site.id}-${w.start}`} onClick={() => open(w)} title="Open this window in the Site view">
                    <td className="mono">{i + 1}</td>
                    <th scope="row">{w.site.name}</th>
                    <td className="mono">{fmt(w.start)}</td>
                    <td className="mono">{w.metrics.illumPct.toFixed(1)}</td>
                    <td className="mono">{w.metrics.longestDarkH.toFixed(0)}</td>
                    <td className="mono">{w.metrics.earthVisPct.toFixed(1)}</td>
                    <td className="mono">{w.metrics.longestCommGapH.toFixed(0)}</td>
                    <td className="mono">{w.score.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="muted small mono">
            {results.length} windows · computed in {(ms / 1000).toFixed(1)} s · click a row to open it
          </div>
        </>
      )}
    </div>
  );
}
