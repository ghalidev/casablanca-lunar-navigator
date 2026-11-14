import { useMemo } from 'react';
import type { Sample, Site } from '../../types';
import { horizonEl } from '../../lib/ephemeris';

// "Horizon ring": polar sky chart seen from the site. Azimuth around the ring (N at top,
// E to the right, clockwise, like a sun-path chart), elevation radial and zoomed:
// +15° at the centre, -10° at the outer edge, so the horizon is a ring near 60% radius.

interface Props {
  site: Site;
  samples: Sample[];
  index: number;
}

const SIZE = 340;
const C = SIZE / 2;
const R = 138;
const EL_MAX = 15;
const EL_MIN = -10;
const D2R = Math.PI / 180;

const COL = {
  text: '#E8E6E1',
  muted: '#6B6B6B',
  grid: '#26262B',
  ground: '#151517',
  horizon: '#8A8A8F',
  sun: '#F2A93B',
  earth: '#4C8DF6',
};
const MONO = "'IBM Plex Mono', ui-monospace, monospace";
const SANS = "'IBM Plex Sans', system-ui, sans-serif";

function pt(az: number, el: number): [number, number] {
  const r = ((EL_MAX - el) / (EL_MAX - EL_MIN)) * R;
  return [C + r * Math.sin(az * D2R), C - r * Math.cos(az * D2R)];
}

function f(n: number): string {
  return n.toFixed(1);
}

/** Two SVG paths: track parts where the body is up, and parts where it is behind terrain. */
function trackPaths(samples: Sample[], body: 'sun' | 'earth'): { up: string; down: string } {
  let up = '';
  let down = '';
  let prev: { x: number; y: number; vis: boolean } | null = null;
  for (const s of samples) {
    const az = body === 'sun' ? s.sunAz : s.earthAz;
    const el = body === 'sun' ? s.sunEl : s.earthEl;
    const vis = body === 'sun' ? s.sunFrac > 0 : s.earthVisible;
    const [x, y] = pt(az, el);
    if (!prev || prev.vis !== vis) {
      // start a new sub-path; repeat the previous point so the two styles join without a gap
      const start = prev ? `M${f(prev.x)},${f(prev.y)}L${f(x)},${f(y)}` : `M${f(x)},${f(y)}`;
      if (vis) up += start;
      else down += start;
    } else if (vis) up += `L${f(x)},${f(y)}`;
    else down += `L${f(x)},${f(y)}`;
    prev = { x, y, vis };
  }
  return { up, down };
}

function fmtTime(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16) + ' UTC';
}

const EL_RINGS = [10, 5, 0, -5];
const AZ_TICKS = Array.from({ length: 12 }, (_, i) => i * 30);
const CARDINAL: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

export function SkyPlot({ site, samples, index }: Props) {
  const hasTerrain = !!site.horizon && site.horizon.length > 0;

  const horizonPath = useMemo(() => {
    let d = '';
    for (let az = 0; az < 360; az += 1) {
      const [x, y] = pt(az, horizonEl(site.horizon, az));
      d += `${az === 0 ? 'M' : 'L'}${f(x)},${f(y)}`;
    }
    return d + 'Z';
  }, [site.horizon]);

  const sun = useMemo(() => trackPaths(samples, 'sun'), [samples]);
  const earth = useMemo(() => trackPaths(samples, 'earth'), [samples]);

  const cur = samples.length > 0 ? samples[Math.min(Math.max(index, 0), samples.length - 1)] : null;
  const sunPos = cur ? pt(cur.sunAz, cur.sunEl) : null;
  const earthPos = cur ? pt(cur.earthAz, cur.earthEl) : null;
  const clipId = `sky-clip-${site.id}`;

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width="100%"
        role="img"
        aria-label={`Sky chart at ${site.name}: Sun and Earth paths relative to the ${hasTerrain ? 'terrain' : 'flat'} horizon`}
        style={{ display: 'block', maxWidth: 420, userSelect: 'none' }}
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx={C} cy={C} r={R} />
          </clipPath>
        </defs>

        <circle cx={C} cy={C} r={R} fill="#0B0B0C" />
        {/* ground = everything below the horizon line (outer band) */}
        <path
          d={`M${C - R},${C}a${R},${R} 0 1,0 ${2 * R},0a${R},${R} 0 1,0 ${-2 * R},0Z${horizonPath}`}
          fill={COL.ground}
          fillRule="evenodd"
        />

        {EL_RINGS.map((el) => {
          const r = ((EL_MAX - el) / (EL_MAX - EL_MIN)) * R;
          return <circle key={el} cx={C} cy={C} r={r} fill="none" stroke={COL.grid} strokeDasharray={el === 0 ? undefined : '2 3'} />;
        })}
        {AZ_TICKS.map((az) => {
          const [x0, y0] = pt(az, EL_MAX - 2.5);
          const [x1, y1] = pt(az, EL_MIN);
          const [lx, ly] = [C + (R + 12) * Math.sin(az * D2R), C - (R + 12) * Math.cos(az * D2R)];
          const card = CARDINAL[az];
          return (
            <g key={az}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={COL.grid} />
              <text
                x={lx}
                y={ly}
                fill={card ? COL.text : COL.muted}
                fontFamily={MONO}
                fontSize={card ? 11 : 8}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {card ?? `${az}°`}
              </text>
            </g>
          );
        })}
        {[...EL_RINGS, EL_MIN].map((el) => (
          <text key={el} x={C + 3} y={C + ((EL_MAX - el) / (EL_MAX - EL_MIN)) * R - 2} fill={COL.muted} fontFamily={MONO} fontSize={8}>
            {el > 0 ? `+${el}` : el}°
          </text>
        ))}
        <circle cx={C} cy={C} r={R} fill="none" stroke={COL.grid} />

        <path d={horizonPath} fill="none" stroke={COL.horizon} strokeWidth={1.25} strokeDasharray={hasTerrain ? undefined : '5 3'} />

        <g clipPath={`url(#${clipId})`} fill="none" strokeLinejoin="round">
          <path d={earth.down} stroke={COL.earth} strokeOpacity={0.25} strokeWidth={1} />
          <path d={sun.down} stroke={COL.sun} strokeOpacity={0.25} strokeWidth={1} />
          <path d={earth.up} stroke={COL.earth} strokeWidth={1.5} />
          <path d={sun.up} stroke={COL.sun} strokeWidth={1.5} />
          {earthPos && cur && (
            <circle cx={earthPos[0]} cy={earthPos[1]} r={5} fill={cur.earthVisible ? COL.earth : '#0B0B0C'} stroke={COL.earth} strokeWidth={1.5} />
          )}
          {sunPos && cur && (
            <circle cx={sunPos[0]} cy={sunPos[1]} r={5} fill={cur.sunFrac > 0 ? COL.sun : '#0B0B0C'} stroke={COL.sun} strokeWidth={1.5} />
          )}
        </g>
      </svg>

      <figcaption style={{ fontFamily: SANS, fontSize: 12, color: COL.muted, marginTop: 6, lineHeight: 1.6 }}>
        {cur ? (
          <div style={{ fontFamily: MONO, color: COL.text }}>
            <div>{fmtTime(cur.t)}</div>
            <div>
              <span style={{ color: COL.sun }}>SUN</span> az {cur.sunAz.toFixed(1)}° el {cur.sunEl.toFixed(2)}° · disc{' '}
              {(cur.sunFrac * 100).toFixed(0)}% up
            </div>
            <div>
              <span style={{ color: COL.earth }}>EARTH</span> az {cur.earthAz.toFixed(1)}° el {cur.earthEl.toFixed(2)}° ·{' '}
              {cur.earthVisible ? 'visible' : 'hidden'}
            </div>
          </div>
        ) : (
          <div>No samples for this range.</div>
        )}
        <div>
          Centre +15°, edge -10°. Shaded band = below the {hasTerrain ? 'terrain' : 'flat (no terrain data)'} horizon. Faint
          line = behind the horizon. Filled dot = up now, hollow = hidden.
        </div>
      </figcaption>
    </figure>
  );
}
