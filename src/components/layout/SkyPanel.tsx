import { useEffect, useState } from 'react';
import type { Sample, Site } from '../../types';
import { SkyPlot } from '../sky/SkyPlot';
import { sampleState } from '../cards/localMetrics';

const STATE_TEXT = {
  both: 'Sun and Earth up: power and comms',
  sun: 'Sun up, Earth down: power, no direct comms',
  earth: 'Earth up, Sun down: comms, on battery',
  dark: 'Both down: on battery, no comms',
} as const;

interface Props {
  site: Site;
  samples: Sample[];
  index: number;
  onIndex: (i: number) => void;
}

/** Adam's horizon ring + a time slider and Play button shared with the timeline cursor. */
export function SkyPanel({ site, samples, index, onIndex }: Props) {
  const [playing, setPlaying] = useState(false);
  const last = Math.max(0, samples.length - 1);
  const i = Math.min(index, last);
  const s = samples[i];

  useEffect(() => {
    if (!playing || samples.length === 0) return;
    const speed = Math.max(1, Math.round(samples.length / 300)); // a full range in ~10 s
    const id = window.setInterval(() => onIndex(i + speed > last ? 0 : i + speed), 33);
    return () => window.clearInterval(id);
  }, [playing, i, last, samples.length, onIndex]);

  if (!s) return null;
  const state = sampleState(s);

  return (
    <div className="sky-panel">
      <div className="sky-plot">
        <SkyPlot site={site} samples={samples} index={i} />
      </div>
      <div className="sky-side">
        <h3 className="sky-title">Sky from the site</h3>
        <div className="mono sky-time">{s.t.slice(0, 16).replace('T', ' ')} UTC</div>
        <div className={`sky-state st-${state}`}>{STATE_TEXT[state]}</div>
        <div className="sky-controls">
          <button className="btn" onClick={() => setPlaying((p) => !p)}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <input
            type="range"
            min={0}
            max={last}
            value={i}
            onChange={(e) => {
              setPlaying(false);
              onIndex(Number(e.target.value));
            }}
            aria-label="Time"
          />
        </div>
        <p className="muted small">
          Looking up from the site: north at the top, the horizon is the ring. Inside the ring is sky, outside is below the
          horizon. Drag the slider or press Play to move through time.
        </p>
      </div>
    </div>
  );
}
