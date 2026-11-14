import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Sample } from '../../types';
import { sampleState, type SampleState } from '../cards/localMetrics';

export const STATE_COLORS: Record<SampleState, string> = {
  both: 'var(--both)',
  sun: 'var(--sun)',
  earth: 'var(--earth)',
  dark: 'var(--dark-band)',
};

const STATE_LABELS: Record<SampleState, string> = {
  both: 'Sun + Earth: power and comms',
  sun: 'Sunlight only: power, no direct comms',
  earth: 'Earth only: comms, running on battery',
  dark: 'Dark and silent: battery only, no comms',
};

const dayFmt = (ts: number) =>
  new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });

const fullFmt = (ts: number) => new Date(ts).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

interface Point {
  ts: number;
  sunEl: number;
  earthEl: number;
  state: SampleState;
}

interface Segment {
  x1: number;
  x2: number;
  state: SampleState;
}

export function Timeline({ samples, cursorIndex }: { samples: Sample[]; cursorIndex?: number }) {
  const { data, segments, yMin, yMax } = useMemo(() => {
    const pts: Point[] = samples.map((s) => ({
      ts: Date.parse(s.t),
      sunEl: s.sunEl,
      earthEl: s.earthEl,
      state: sampleState(s),
    }));
    const segs: Segment[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const last = segs[segs.length - 1];
      const next = pts[i + 1]?.ts ?? p.ts;
      if (last && last.state === p.state) last.x2 = next;
      else segs.push({ x1: p.ts, x2: next, state: p.state });
    }
    let lo = 0;
    let hi = 0;
    for (const p of pts) {
      lo = Math.min(lo, p.sunEl, p.earthEl);
      hi = Math.max(hi, p.sunEl, p.earthEl);
    }
    return { data: pts, segments: segs, yMin: Math.floor(lo - 1), yMax: Math.ceil(hi + 1) };
  }, [samples]);

  if (data.length === 0) return <div className="empty">No samples for this range.</div>;
  const cursorTs = cursorIndex !== undefined ? data[Math.min(cursorIndex, data.length - 1)]?.ts : undefined;

  return (
    <div className="timeline">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          {segments.map((s, i) => (
            <ReferenceArea
              key={i}
              x1={s.x1}
              x2={s.x2}
              y1={yMin}
              y2={yMax}
              fill={STATE_COLORS[s.state]}
              fillOpacity={s.state === 'dark' ? 0.5 : 0.16}
              stroke="none"
              ifOverflow="hidden"
            />
          ))}
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={dayFmt}
            stroke="var(--muted)"
            tick={{ fontSize: 11, fontFamily: 'var(--mono)' }}
            minTickGap={24}
          />
          <YAxis
            domain={[yMin, yMax]}
            stroke="var(--muted)"
            tick={{ fontSize: 11, fontFamily: 'var(--mono)' }}
            tickFormatter={(v: number) => `${v}°`}
            allowDecimals={false}
          />
          <ReferenceLine y={0} stroke="var(--text)" strokeDasharray="4 4" label={{ value: 'horizon', fill: 'var(--muted)', fontSize: 11, position: 'insideTopLeft' }} />
          <Tooltip
            content={({ active, payload }) => {
              const p = active && payload && payload.length ? (payload[0].payload as Point) : null;
              if (!p) return null;
              return (
                <div className="tip mono">
                  <div>{fullFmt(p.ts)}</div>
                  <div style={{ color: 'var(--sun)' }}>Sun {p.sunEl.toFixed(2)}°</div>
                  <div style={{ color: 'var(--earth)' }}>Earth {p.earthEl.toFixed(2)}°</div>
                  <div className="tip-state">{STATE_LABELS[p.state]}</div>
                </div>
              );
            }}
          />
          {cursorTs !== undefined && <ReferenceLine x={cursorTs} stroke="var(--text)" strokeWidth={1} />}
          <Line type="monotone" dataKey="sunEl" stroke="var(--sun)" strokeWidth={2} dot={false} isAnimationActive={false} name="Sun elevation" />
          <Line type="monotone" dataKey="earthEl" stroke="var(--earth)" strokeWidth={2} dot={false} isAnimationActive={false} name="Earth elevation" />
        </LineChart>
      </ResponsiveContainer>
      <div className="legend">
        <span><i className="line" style={{ background: 'var(--sun)' }} />Sun elevation</span>
        <span><i className="line" style={{ background: 'var(--earth)' }} />Earth elevation</span>
        {(Object.keys(STATE_LABELS) as SampleState[]).map((k) => (
          <span key={k}>
            <i className="swatch" style={{ background: STATE_COLORS[k], opacity: k === 'dark' ? 1 : 0.6 }} />
            {STATE_LABELS[k]}
          </span>
        ))}
      </div>
    </div>
  );
}
