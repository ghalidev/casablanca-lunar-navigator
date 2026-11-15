import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Site } from '../types';
import { loadSites } from './sites';

export type Mode = 'planner' | 'explore';
export type Tab = 'site' | 'compare' | 'windows';

export const MAX_COMPARE = 4;
const DAY_MS = 86_400_000;
const MAX_POINTS = 2000;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const todayUTC = () => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

// ---- Shareable URL: ?site=haworth&from=2026-12-01&to=2026-12-31&compare=a,b,c&mode=explore&tab=compare
// A custom point is shared as ?lat=-89.45&lon=-137.3 instead of site=.
interface UrlState {
  site?: string;
  from?: string;
  to?: string;
  compare?: string[];
  mode?: Mode;
  tab?: Tab;
  lat?: number;
  lon?: number;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function readUrl(): UrlState {
  const p = new URLSearchParams(window.location.search);
  const day = (k: string) => {
    const v = p.get(k);
    return v && DAY_RE.test(v) && Number.isFinite(Date.parse(v)) ? v : undefined;
  };
  const lat = Number(p.get('lat'));
  const lon = Number(p.get('lon'));
  const hasPoint = p.has('lat') && p.has('lon') && lat <= -60 && lat >= -89.99 && Math.abs(lon) <= 180;
  return {
    site: p.get('site') ?? undefined,
    from: day('from'),
    to: day('to'),
    compare: p.get('compare')?.split(',').filter(Boolean),
    mode: p.get('mode') === 'explore' ? 'explore' : undefined,
    tab: p.get('tab') === 'compare' ? 'compare' : p.get('tab') === 'windows' ? 'windows' : undefined,
    lat: hasPoint ? lat : undefined,
    lon: hasPoint ? lon : undefined,
  };
}

function makeCustomSite(lat: number, lon: number): Site {
  return {
    id: `custom-${lat.toFixed(3)}-${lon.toFixed(3)}`,
    name: `Custom ${Math.abs(lat).toFixed(2)}°S ${lon.toFixed(2)}°E`,
    lat,
    lon,
    source: 'user-defined point',
  };
}

/** Step that keeps the number of samples under MAX_POINTS, in whole 30-minute units. */
export function stepForRange(startISO: string, endISO: string): number {
  const minutes = (Date.parse(endISO) - Date.parse(startISO)) / 60_000;
  return Math.max(30, Math.ceil(minutes / MAX_POINTS / 30) * 30);
}

interface AppState {
  sites: Site[];
  sitesMock: boolean;
  sitesLoading: boolean;
  focusId: string | null;
  compareIds: string[];
  startDate: string; // YYYY-MM-DD, UTC
  endDate: string;
  startISO: string;
  endISO: string;
  stepMin: number;
  mode: Mode;
  tab: Tab;
  setFocus: (id: string) => void;
  toggleCompare: (id: string) => void;
  setRange: (start: string, end: string) => void;
  setMode: (m: Mode) => void;
  setTab: (t: Tab) => void;
  addCustomSite: (lat: number, lon: number) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [url] = useState(readUrl);
  const [today] = useState(todayUTC);
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesMock, setSitesMock] = useState(true);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const from = url.from ?? isoDay(today);
    return url.to && url.to < from ? url.to : from;
  });
  const [endDate, setEndDate] = useState(() => {
    const from = url.from ?? isoDay(today);
    const to = url.to ?? isoDay(Date.parse(from) + 30 * DAY_MS);
    return to < from ? from : to;
  });
  const [mode, setMode] = useState<Mode>(url.mode ?? 'planner');
  const [tab, setTab] = useState<Tab>(url.tab ?? 'site');

  useEffect(() => {
    let alive = true;
    loadSites().then(({ sites: loaded, mock }) => {
      if (!alive) return;
      const custom = url.lat !== undefined && url.lon !== undefined ? makeCustomSite(url.lat, url.lon) : null;
      const all = custom ? [...loaded, custom] : loaded;
      const has = (id: string) => all.some((s) => s.id === id);
      setSites(all);
      setSitesMock(mock);
      setSitesLoading(false);
      setFocusId(custom?.id ?? (url.site && has(url.site) ? url.site : loaded[0]?.id ?? null));
      const fromUrl = (url.compare ?? []).filter(has).slice(0, MAX_COMPARE);
      setCompareIds(fromUrl.length ? fromUrl : loaded.slice(0, 3).map((s) => s.id));
    });
    return () => {
      alive = false;
    };
  }, [url]);

  // Keep the address bar in sync so the current view can be shared as a link.
  useEffect(() => {
    if (sitesLoading) return;
    const p = new URLSearchParams();
    const focus = sites.find((s) => s.id === focusId);
    if (focus?.id.startsWith('custom-')) {
      p.set('lat', String(focus.lat));
      p.set('lon', String(focus.lon));
    } else if (focus) {
      p.set('site', focus.id);
    }
    p.set('from', startDate);
    p.set('to', endDate);
    const shared = compareIds.filter((id) => !id.startsWith('custom-'));
    if (shared.length) p.set('compare', shared.join(','));
    if (mode === 'explore') p.set('mode', 'explore');
    if (tab !== 'site') p.set('tab', tab);
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString().replace(/%2C/g, ',')}`);
  }, [sitesLoading, sites, focusId, startDate, endDate, compareIds, mode, tab]);

  const setRange = useCallback((start: string, end: string) => {
    if (!start || !end) return;
    if (start <= end) {
      setStartDate(start);
      setEndDate(end);
    } else {
      setStartDate(end);
      setEndDate(start);
    }
  }, []);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= MAX_COMPARE) return [...ids.slice(1), id];
      return [...ids, id];
    });
  }, []);

  const addCustomSite = useCallback((lat: number, lon: number) => {
    const site = makeCustomSite(lat, lon);
    setSites((list) => (list.some((s) => s.id === site.id) ? list : [...list, site]));
    setFocusId(site.id);
  }, []);

  const value = useMemo<AppState>(() => {
    const startISO = `${startDate}T00:00:00Z`;
    const endISO = `${endDate}T00:00:00Z`;
    return {
      sites,
      sitesMock,
      sitesLoading,
      focusId,
      compareIds,
      startDate,
      endDate,
      startISO,
      endISO,
      stepMin: stepForRange(startISO, endISO),
      mode,
      tab,
      setFocus: setFocusId,
      toggleCompare,
      setRange,
      setMode,
      setTab,
      addCustomSite,
    };
  }, [sites, sitesMock, sitesLoading, focusId, compareIds, startDate, endDate, mode, tab, toggleCompare, setRange, addCustomSite]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
