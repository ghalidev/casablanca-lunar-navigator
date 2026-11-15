import { Link } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { lastMissionUrl } from '../lib/missionMemory'

/** Brand and the one page outside the film. Shots are chosen on the rail, not here. */
export function TopBar({ variant = 'page', right }: { variant?: 'page' | 'mission'; right?: React.ReactNode }) {
  return (
    <header className={'topbar is-' + variant}>
      <div className="topbar-left">
        <Link to="/?ch=moon" className="topbar-mark">
          Lastlight
        </Link>
        {variant === 'page' && (
          <Link to={lastMissionUrl()} className="topbar-back">
            <ArrowLeft size={15} /> Back to the film
          </Link>
        )}
      </div>
      <div className="topbar-right">
        {right}
        {variant === 'mission' && (
          <Link to="/method" className="topbar-link">
            Method
          </Link>
        )}
      </div>
    </header>
  )
}
