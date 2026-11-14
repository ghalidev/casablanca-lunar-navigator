import { useState, type FormEvent } from 'react';
import { MAX_COMPARE, useApp } from '../../state/store';
import { SouthPoleMap } from '../map/SouthPoleMap';

export function SitePanel() {
  const { sites, sitesLoading, focusId, compareIds, setFocus, toggleCompare, startDate, endDate, setRange, stepMin, addCustomSite } =
    useApp();
  const [lat, setLat] = useState('-89.45');
  const [lon, setLon] = useState('-137.3');

  const onCustom = (e: FormEvent) => {
    e.preventDefault();
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || la > -60 || la < -89.99 || lo < -180 || lo > 180) return;
    addCustomSite(la, lo);
  };

  return (
    <aside className="panel">
      <div className="map-box">
        <SouthPoleMap sites={sites} focusId={focusId} compareIds={compareIds} onFocus={setFocus} onCustom={addCustomSite} />
      </div>

      <section>
        <h3>Dates (UTC)</h3>
        <div className="dates">
          <label>
            From
            <input type="date" value={startDate} onChange={(e) => setRange(e.target.value, endDate)} />
          </label>
          <label>
            To
            <input type="date" value={endDate} onChange={(e) => setRange(startDate, e.target.value)} />
          </label>
        </div>
        <div className="muted small mono">step {stepMin} min</div>
      </section>

      <section>
        <h3>
          Sites <span className="muted small">compare up to {MAX_COMPARE}</span>
        </h3>
        {sitesLoading ? (
          <div className="muted">Loading…</div>
        ) : (
          <ul className="sites">
            {sites.map((s) => (
              <li key={s.id} className={s.id === focusId ? 'focus' : ''}>
                <input
                  type="checkbox"
                  aria-label={`Compare ${s.name}`}
                  checked={compareIds.includes(s.id)}
                  onChange={() => toggleCompare(s.id)}
                />
                <button onClick={() => setFocus(s.id)}>
                  <span>{s.name}</span>
                  <span className="mono muted small">
                    {s.lat.toFixed(2)}°, {s.lon.toFixed(2)}°{s.approximate ? ' ~' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3>Custom point</h3>
        <form className="custom" onSubmit={onCustom}>
          <label>
            Lat
            <input className="mono" value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" />
          </label>
          <label>
            Lon (E)
            <input className="mono" value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" />
          </label>
          <button type="submit">Add</button>
        </form>
        <div className="muted small">Latitude between -60 and -89.99. Longitude east-positive.</div>
      </section>
    </aside>
  );
}
