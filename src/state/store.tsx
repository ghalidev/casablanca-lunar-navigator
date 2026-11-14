import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Site } from '../types';
import { loadSites } from './sites';

export type Mode = 'planner' | 'explore';
export type Tab = 'site' | 'compare';

export const MAX_COMPARE = 4;
const DAY_MS = 86_400_000;
const MAX_POINTS = 2000;

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const todayUTC = () => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

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
  const [today] = useState(todayUTC);
  const [sites, setSites] = useState<Site[]>([]);
  const [sitesMock, setSitesMock] = useState(true);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(isoDay(today));
  const [endDate, setEndDate] = useState(isoDay(today + 30 * DAY_MS));
  const [mode, setMode] = useState<Mode>('planner');
  const [tab, setTab] = useState<Tab>('site');

  useEffect(() => {
    let alive = true;
    loadSites().then(({ sites: loaded, mock }) => {
      if (!alive) return;
      setSites(loaded);
      setSitesMock(mock);
      setSitesLoading(false);
      setFocusId((f) => f ?? loaded[0]?.id ?? null);
      setCompareIds((c) => (c.length ? c : loaded.slice(0, 3).map((s) => s.id)));
    });
    return () => {
      alive = false;
    };
  }, []);

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
    const id = `custom-${lat.toFixed(3)}-${lon.toFixed(3)}`;
    const site: Site = {
      id,
      name: `Custom ${Math.abs(lat).toFixed(2)}°S ${lon.toFixed(2)}°E`,
      lat,
      lon,
      source: 'user-defined point',
    };
    setSites((list) => (list.some((s) => s.id === id) ? list : [...list, site]));
    setFocusId(id);
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
