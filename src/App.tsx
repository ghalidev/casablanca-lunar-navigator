import { useMemo } from 'react';
import { computeTrack } from './lib/ephemeris';
import type { Sample, Site } from './types';
import { AppProvider, useApp } from './state/store';
import { Banners, Header } from './components/layout/Header';
import { SitePanel } from './components/layout/SitePanel';
import { Timeline } from './components/timeline/Timeline';
import { MetricCards } from './components/cards/MetricCards';
import { computeMetricsLocal } from './components/cards/localMetrics';
import { CompareTable } from './components/compare/CompareTable';

function useTracks(sites: Site[], startISO: string, endISO: string, stepMin: number): Map<string, Sample[]> {
  return useMemo(() => {
    const m = new Map<string, Sample[]>();
    for (const s of sites) m.set(s.id, computeTrack(s, startISO, endISO, stepMin));
    return m;
  }, [sites, startISO, endISO, stepMin]);
}

function Main() {
  const { sites, focusId, compareIds, startISO, endISO, stepMin, mode, tab, setTab } = useApp();

  const focus = sites.find((s) => s.id === focusId) ?? null;
  const needed = useMemo(() => {
    const ids = new Set<string>(compareIds);
    if (focusId) ids.add(focusId);
    return sites.filter((s) => ids.has(s.id));
  }, [sites, compareIds, focusId]);

  const tracks = useTracks(needed, startISO, endISO, stepMin);
  const focusSamples = useMemo(() => (focus ? tracks.get(focus.id) ?? [] : []), [focus, tracks]);
  const focusMetrics = useMemo(() => computeMetricsLocal(focusSamples, stepMin), [focusSamples, stepMin]);
  const compareRows = useMemo(
    () =>
      sites
        .filter((s) => compareIds.includes(s.id))
        .map((site) => ({ site, metrics: computeMetricsLocal(tracks.get(site.id) ?? [], stepMin) })),
    [sites, compareIds, tracks, stepMin],
  );

  const flatHorizon = needed.some((s) => !s.horizon);

  return (
    <main className="main">
      <Banners flatHorizon={flatHorizon} />
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'site'} className={tab === 'site' ? 'on' : ''} onClick={() => setTab('site')}>
          Site
        </button>
        <button role="tab" aria-selected={tab === 'compare'} className={tab === 'compare' ? 'on' : ''} onClick={() => setTab('compare')}>
          Compare ({compareIds.length})
        </button>
      </div>

      {tab === 'site' && focus && (
        <>
          <div className="site-head">
            <h2>{focus.name}</h2>
            <div className="mono muted small">
              {focus.lat.toFixed(3)}°, {focus.lon.toFixed(3)}°E · {focus.source}
            </div>
          </div>
          {mode === 'explore' && (
            <p className="explain">
              At the lunar south pole the Sun and Earth never climb high: they skim the horizon. The amber line is the Sun, the
              blue line is Earth. Above the dashed horizon line, the lander gets power (Sun) or can talk to Earth (Earth). The
              coloured stripes show what the lander has at every moment.
            </p>
          )}
          <Timeline samples={focusSamples} />
          <MetricCards metrics={focusMetrics} mode={mode} />
        </>
      )}

      {tab === 'compare' && <CompareTable rows={compareRows} />}
    </main>
  );
}

export default function App() {
  return (
    <AppProvider>
      <div className="app">
        <Header />
        <div className="layout">
          <SitePanel />
          <Main />
        </div>
        <footer className="footer muted small">
          Sun and Earth positions: astronomy-engine (IAU lunar rotation model). Team Casablanca, NASA Space Apps 2026.
        </footer>
      </div>
    </AppProvider>
  );
}
