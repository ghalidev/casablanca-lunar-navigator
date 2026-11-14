import { useMemo, type MouseEvent } from 'react';
import type { Site } from '../../types';

// South polar stereographic map, 80°S–90°S. 0° longitude at the top, east-positive clockwise
// (same orientation as NASA's Artemis III region maps). Pure SVG, no image.

interface Props {
  sites: Site[];
  focusId: string | null;
  compareIds: string[];
  onFocus(id: string): void;
  onCustom(lat: number, lon: number): void;
}

const SIZE = 320;
const C = SIZE / 2;
const R_EDGE = 128; // radius of the 80°S circle in SVG units
const EDGE_COLAT = 10;
const K = R_EDGE / Math.tan(((EDGE_COLAT / 2) * Math.PI) / 180);
const D2R = Math.PI / 180;

const COLORS = {
  text: '#E8E6E1',
  muted: '#6B6B6B',
  grid: '#26262B',
  edge: '#3A3A40',
  sun: '#F2A93B',
  both: '#3FB68B',
};
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

function project(lat: number, lon: number): [number, number] {
  const r = K * Math.tan(((90 + lat) / 2) * D2R); // colatitude from the south pole = 90 + lat
  return [C + r * Math.sin(lon * D2R), C - r * Math.cos(lon * D2R)];
}

function unproject(x: number, y: number): [number, number] | null {
  const dx = x - C;
  const dy = C - y;
  const r = Math.hypot(dx, dy);
  if (r > R_EDGE) return null;
  const colat = (2 * Math.atan(r / K)) / D2R;
  const lat = Math.max(-(90 - colat), -89.99); // never exactly -90 (azimuth undefined)
  const lon = r === 0 ? 0 : Math.atan2(dx, dy) / D2R;
  return [lat, lon];
}

function lonLabel(lon: number): string {
  if (lon === 0) return '0°';
  if (lon === 180) return '180°';
  return lon > 0 ? `${lon}°E` : `${-lon}°W`;
}

const LAT_RINGS = [82, 84, 86, 88];
const SPOKES = Array.from({ length: 12 }, (_, i) => (i <= 6 ? i * 30 : i * 30 - 360));

export function SouthPoleMap({ sites, focusId, compareIds, onFocus, onCustom }: Props) {
  const ringRadii = useMemo(() => LAT_RINGS.map((l) => ({ l, r: K * Math.tan(((90 - l) / 2) * D2R) })), []);

  function handleBackgroundClick(e: MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = pt.matrixTransform(ctm.inverse());
    const ll = unproject(p.x, p.y);
    if (ll) onCustom(Number(ll[0].toFixed(3)), Number(ll[1].toFixed(3)));
  }

  // Draw the focused site last so it sits on top.
  const ordered = [...sites].sort((a, b) => Number(a.id === focusId) - Number(b.id === focusId));

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width="100%"
      role="img"
      aria-label="South polar map, 80 to 90 degrees south. Click a site to focus it, or empty ground to add a custom site."
      onClick={handleBackgroundClick}
      style={{ display: 'block', cursor: 'crosshair', userSelect: 'none' }}
    >
      <circle cx={C} cy={C} r={R_EDGE} fill="#0B0B0C" stroke={COLORS.edge} />
      {ringRadii.map(({ l, r }) => (
        <circle key={l} cx={C} cy={C} r={r} fill="none" stroke={COLORS.grid} strokeDasharray={l === 88 ? undefined : '2 3'} />
      ))}
      {SPOKES.map((lon) => {
        const [x, y] = project(-80, lon);
        const [lx, ly] = [C + (R_EDGE + 13) * Math.sin(lon * D2R), C - (R_EDGE + 13) * Math.cos(lon * D2R)];
        return (
          <g key={lon}>
            <line x1={C} y1={C} x2={x} y2={y} stroke={COLORS.grid} />
            <text
              x={lx}
              y={ly}
              fill={COLORS.muted}
              fontFamily={MONO}
              fontSize={9}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {lonLabel(lon)}
            </text>
          </g>
        );
      })}
      {ringRadii.map(({ l, r }) => (
        <text key={l} x={C + 3} y={C + r - 2} fill={COLORS.muted} fontFamily={MONO} fontSize={8}>
          {l}°S
        </text>
      ))}
      <text x={C + 3} y={C + R_EDGE - 2} fill={COLORS.muted} fontFamily={MONO} fontSize={8}>
        80°S
      </text>
      <line x1={C - 4} y1={C} x2={C + 4} y2={C} stroke={COLORS.muted} />
      <line x1={C} y1={C - 4} x2={C} y2={C + 4} stroke={COLORS.muted} />

      {ordered.map((s) => {
        const [x, y] = project(s.lat, s.lon);
        const focused = s.id === focusId;
        const compared = compareIds.includes(s.id);
        return (
          <g
            key={s.id}
            onClick={(e) => {
              e.stopPropagation();
              onFocus(s.id);
            }}
            style={{ cursor: 'pointer' }}
          >
            <title>
              {`${s.name}  ${s.lat.toFixed(2)}°, ${s.lon.toFixed(2)}°E${s.approximate ? ' (approximate)' : ''}`}
            </title>
            <circle cx={x} cy={y} r={9} fill="transparent" />
            {compared && <circle cx={x} cy={y} r={focused ? 7.5 : 6} fill="none" stroke={COLORS.both} strokeWidth={1.5} />}
            <circle
              cx={x}
              cy={y}
              r={focused ? 4.5 : 3}
              fill={focused ? COLORS.sun : COLORS.text}
              stroke={focused ? COLORS.sun : 'none'}
            />
            {focused && (
              <text
                x={x}
                y={y + (y > C ? 16 : -11)}
                fill={COLORS.sun}
                fontFamily="'IBM Plex Sans', system-ui, sans-serif"
                fontSize={10}
                textAnchor={x > SIZE - 70 ? 'end' : x < 70 ? 'start' : 'middle'}
                style={{ pointerEvents: 'none' }}
              >
                {s.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
