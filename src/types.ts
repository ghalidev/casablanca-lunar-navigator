// FROZEN CONTRACT — do not change without the whole team agreeing.
// Units: degrees, ISO 8601 UTC strings, hours, km. Longitude east-positive.

export interface Site {
  id: string; // "connecting-ridge"
  name: string;
  lat: number; // deg, south negative
  lon: number; // deg, east positive (-180..180)
  heightM?: number; // height above the 1737.4 km reference sphere
  source: string; // citation for the coordinates
  approximate?: boolean; // true if the point is an approximate region center
  horizon?: number[]; // 360 values: terrain horizon elevation (deg) at azimuth 0..359; absent = flat (0)
}

export interface Sample {
  t: string; // ISO UTC
  sunAz: number;
  sunEl: number;
  earthAz: number;
  earthEl: number;
  sunFrac: number; // 0..1 fraction of the solar disc above the local horizon
  earthVisible: boolean; // Earth center above horizon + margin
}

export interface SiteMetrics {
  illumPct: number; // % of time sunFrac > 0.5
  longestDarkH: number; // longest continuous darkness (battery survival)
  earthVisPct: number; // % of time Earth visible
  longestCommGapH: number; // longest continuous time without Earth
  bothPct: number; // % of time sunlit AND Earth visible (ideal operations)
  energyKWhPerKW: number; // energy per 1 kW of vertical solar panel over the range
}

export interface MissionWindow {
  start: string; // ISO UTC
  end: string; // ISO UTC
  score: number; // higher is better
  metrics: SiteMetrics;
}

// Function signatures (implemented by Yasin in src/lib/):
export type ComputeTrack = (site: Site, startISO: string, endISO: string, stepMin: number) => Sample[];
export type ComputeMetrics = (samples: Sample[], stepMin: number) => SiteMetrics;
export type FindBestWindows = (
  site: Site,
  fromISO: string,
  toISO: string,
  durationDays: number,
) => MissionWindow[];
