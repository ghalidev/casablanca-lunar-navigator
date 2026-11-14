import { useApp } from '../../state/store';

export function Header() {
  const { mode, setMode } = useApp();
  return (
    <header className="header">
      <div>
        <div className="brand">LASTLIGHT</div>
        <div className="tagline">Choose where and when your lander survives the lunar south pole.</div>
      </div>
      <div className="seg" role="group" aria-label="Audience">
        <button className={mode === 'planner' ? 'on' : ''} onClick={() => setMode('planner')}>
          Planner
        </button>
        <button className={mode === 'explore' ? 'on' : ''} onClick={() => setMode('explore')}>
          Explore
        </button>
      </div>
    </header>
  );
}

export function Banners({ flatHorizon }: { flatHorizon: boolean }) {
  const { sitesMock } = useApp();
  return (
    <>
      {sitesMock && (
        <div className="banner">
          <b>MOCK DATA</b> Site positions are placeholders, not the official Artemis III region coordinates.
        </div>
      )}
      {flatHorizon && (
        <div className="banner subtle">
          <b>FLAT HORIZON</b> Terrain is not included yet. Real sites can be shadowed by mountains up to 150 km away.
        </div>
      )}
    </>
  );
}
