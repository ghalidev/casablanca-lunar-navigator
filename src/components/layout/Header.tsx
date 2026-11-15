import { useState } from 'react';
import { useApp } from '../../state/store';

function CopyLink() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      window.prompt('Copy this link:', window.location.href);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button className="btn" onClick={copy} title="Copy a link to this exact view">
      {copied ? 'Link copied' : 'Copy link'}
    </button>
  );
}

export function Header() {
  const { mode, setMode } = useApp();
  return (
    <header className="header">
      <div>
        <div className="brand">
          <img src="/brand/lastlight-mark.svg" alt="" width={36} height={29} />
          LASTLIGHT
        </div>
        <div className="tagline">Choose where and when your lander survives the lunar south pole.</div>
      </div>
      <div className="header-actions">
        <CopyLink />
        <div className="seg" role="group" aria-label="Audience">
          <button className={mode === 'planner' ? 'on' : ''} onClick={() => setMode('planner')}>
            Planner
          </button>
          <button className={mode === 'explore' ? 'on' : ''} onClick={() => setMode('explore')}>
            Explore
          </button>
        </div>
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
