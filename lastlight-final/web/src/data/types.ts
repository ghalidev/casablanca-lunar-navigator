// Mirrors contracts/schema.json. Change both in the same PR.
// Times: UTC ISO-8601. Angles: degrees. Azimuth: 0 = local north, clockwise.

export interface Site {
  id: string
  name: string
  lat: number
  lon: number
  position_source?: string
  elevation_m: number
  horizon: { az_step_deg: 0.5; mast_2m: number[]; mast_10m: number[] }
  validation: {
    lroc_illum_pct: number | null
    model_illum_pct: number | null
    pgda_illum_pct?: number | null
  }
}

export interface SitesFile {
  generated_at: string
  mock: boolean
  params_ref?: string
  sites: Site[]
}

export interface SeriesFile {
  site_id: string
  mock: boolean
  params_ref?: string
  mast_m?: number
  t0: string
  step_h: number
  sun_el: number[]
  sun_az: number[]
  earth_el: number[]
  earth_az: number[]
  sun_frac: number[]
  earth_frac: number[]
  irradiance_wm2: number[]
}

export interface SurvivalWindow {
  landing_utc: string
  p_survive_14d: number
  p_comm_ok: number
  median_days_alive: number
  slip_tolerance_days: number
  n_draws?: number
}

export interface GhostLander {
  dx_m: number
  dy_m: number
  tilt_deg: number
  yaw_deg?: number
  died_at_h: number | null
}

export interface SurvivalFile {
  site_id: string
  mock: boolean
  params_ref: string
  windows: SurvivalWindow[]
  ghost_landers_sample: GhostLander[]
  ghost_window_utc?: string
  /** Length of the simulation behind the ghost sample, hours (contract v2). */
  sim_duration_h?: number
}

export interface Top10File {
  generated_at: string
  mock: boolean
  params_ref: string
  criteria: { survive_days: number; p_threshold: number; year_start: number; year_end: number; from_utc?: string; to_utc?: string; ranking?: string }
  windows: (SurvivalWindow & { rank: number; site_id: string })[]
}
