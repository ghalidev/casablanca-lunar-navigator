// Sun / Earth topocentric positions for a site on the Moon.
// Owner: Yasin. Uses astronomy-engine (IAU 2015 lunar rotation model, EQJ vectors).

import { Body, GeoMoon, GeoVector, MakeTime, RotationAxis } from 'astronomy-engine';
import type { ComputeTrack, Sample, Site } from '../types';

export const MOON_RADIUS_KM = 1737.4;
export const SUN_RADIUS_DEG = 0.267;
export const EARTH_MARGIN_DEG = 0.5;
const AU_KM = 149597870.7;
const DEG = Math.PI / 180;
const MAX_ABS_LAT = 89.9999;

/** Horizon elevation (deg) at azimuth az (deg), linear interpolation over 360 samples. */
export function horizonEl(horizon: number[] | undefined, az: number): number {
  if (!horizon || horizon.length === 0) return 0;
  const n = horizon.length;
  let x = (az / 360) * n;
  x = ((x % n) + n) % n;
  const i0 = Math.floor(x);
  const i1 = (i0 + 1) % n;
  const f = x - i0;
  return horizon[i0] * (1 - f) + horizon[i1] * f;
}

/** Fraction (0..1) of a disc of angular radius r whose centre is `above` deg above the horizon line. */
export function discFraction(above: number, r: number = SUN_RADIUS_DEG): number {
  const h = above / r;
  if (h <= -1) return 0;
  if (h >= 1) return 1;
  return (Math.acos(-h) + h * Math.sqrt(1 - h * h)) / Math.PI;
}

export const computeTrack: ComputeTrack = (site: Site, startISO: string, endISO: string, stepMin: number): Sample[] => {
  const t0 = Date.parse(startISO);
  const t1 = Date.parse(endISO);
  const stepMs = Math.round(stepMin * 60000);
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || stepMs <= 0 || t1 < t0) return [];

  // --- Site frame (body-fixed), computed once ---
  const lat = Math.max(-MAX_ABS_LAT, Math.min(MAX_ABS_LAT, site.lat)) * DEG;
  const lon = site.lon * DEG;
  const sLat = Math.sin(lat), cLat = Math.cos(lat);
  const sLon = Math.sin(lon), cLon = Math.cos(lon);
  const ux = cLat * cLon, uy = cLat * sLon, uz = sLat; // up
  const ex = -sLon, ey = cLon; // east (ez = 0)
  const nx = -sLat * cLon, ny = -sLat * sLon, nz = cLat; // north
  const R = MOON_RADIUS_KM + (site.heightM ?? 0) / 1000;
  const px = R * ux, py = R * uy, pz = R * uz;
  const horizon = site.horizon;

  const out: Sample[] = [];
  for (let ms = t0; ms <= t1; ms += stepMs) {
    const date = new Date(ms);
    const time = MakeTime(date);

    // --- Rotation EQJ -> Moon body-fixed: M = Rz(W) * Rx(90 - dec) * Rz(90 + ra) ---
    const axis = RotationAxis(Body.Moon, time);
    const a = (axis.ra * 15 + 90) * DEG; // ra is in sidereal hours
    const b = (90 - axis.dec) * DEG;
    const w = axis.spin * DEG;
    const ca = Math.cos(a), sa = Math.sin(a);
    const cb = Math.cos(b), sb = Math.sin(b);
    const cw = Math.cos(w), sw = Math.sin(w);
    // Frame rotations: Rz(t) = [[c,s,0],[-s,c,0],[0,0,1]], Rx(t) = [[1,0,0],[0,c,s],[0,-s,c]]
    // Rx(b)*Rz(a):
    //  [ ca,      sa,      0  ]
    //  [ -cb*sa,  cb*ca,   sb ]
    //  [ sb*sa,  -sb*ca,   cb ]
    const r00 = cw * ca - sw * cb * sa, r01 = cw * sa + sw * cb * ca, r02 = sw * sb;
    const r10 = -sw * ca - cw * cb * sa, r11 = -sw * sa + cw * cb * ca, r12 = cw * sb;
    const r20 = sb * sa, r21 = -sb * ca, r22 = cb;

    // --- Vectors from Moon centre, EQJ, km ---
    const moon = GeoMoon(time);
    const sun = GeoVector(Body.Sun, time, true);
    const qx = -moon.x * AU_KM, qy = -moon.y * AU_KM, qz = -moon.z * AU_KM; // Earth
    const gx = (sun.x - moon.x) * AU_KM, gy = (sun.y - moon.y) * AU_KM, gz = (sun.z - moon.z) * AU_KM; // Sun

    // Body-fixed, topocentric
    const Ex = r00 * qx + r01 * qy + r02 * qz - px;
    const Ey = r10 * qx + r11 * qy + r12 * qz - py;
    const Ez = r20 * qx + r21 * qy + r22 * qz - pz;
    const Sx = r00 * gx + r01 * gy + r02 * gz - px;
    const Sy = r10 * gx + r11 * gy + r12 * gz - py;
    const Sz = r20 * gx + r21 * gy + r22 * gz - pz;

    const sunN = Math.hypot(Sx, Sy, Sz);
    const sunEl = Math.asin((Sx * ux + Sy * uy + Sz * uz) / sunN) / DEG;
    let sunAz = Math.atan2(Sx * ex + Sy * ey, Sx * nx + Sy * ny + Sz * nz) / DEG;
    if (sunAz < 0) sunAz += 360;
    if (sunAz >= 360) sunAz -= 360;

    const earthN = Math.hypot(Ex, Ey, Ez);
    const earthEl = Math.asin((Ex * ux + Ey * uy + Ez * uz) / earthN) / DEG;
    let earthAz = Math.atan2(Ex * ex + Ey * ey, Ex * nx + Ey * ny + Ez * nz) / DEG;
    if (earthAz < 0) earthAz += 360;
    if (earthAz >= 360) earthAz -= 360;

    out.push({
      t: date.toISOString(),
      sunAz,
      sunEl,
      earthAz,
      earthEl,
      sunFrac: discFraction(sunEl - horizonEl(horizon, sunAz)),
      earthVisible: earthEl > horizonEl(horizon, earthAz) + EARTH_MARGIN_DEG,
    });
  }
  return out;
};
