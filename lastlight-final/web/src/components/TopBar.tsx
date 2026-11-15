import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { Play } from '@phosphor-icons/react'
import { FilmPlayer } from './FilmPlayer'

/** One top bar for the whole app: the mark, the team, three places, and the film. */
export function TopBar({ variant = 'page', right }: { variant?: 'page' | 'mission'; right?: React.ReactNode }) {
  const [film, setFilm] = useState(false)
  const { pathname } = useLocation()
  const here = (p: string) => (pathname === p ? ' on' : '')
  return (
    <header className={'topbar is-' + variant}>
      <div className="topbar-left">
        <Link to="/?ch=moon" className="topbar-mark" aria-label="LASTLIGHT, back to the start">
          <img src="/brand/lastlight-mark.svg" alt="" width={28} height={28} />
          <span>LASTLIGHT</span>
        </Link>
        <Link to="/method#team" className="topbar-team" title="Houston, we have a problem. From Casablanca, we have a solution. Meet the team.">
          by <b>CWS</b><span className="team-long"> · Casablanca, We Have A Solution</span>
        </Link>
      </div>
      <nav className="topbar-right">
        {right}
        <Link to="/" className={'topbar-link' + here('/')}>
          Story
        </Link>
        <Link to="/explore" className={'topbar-link' + here('/explore')}>
          Planner
        </Link>
        <Link to="/method" className={'topbar-link' + here('/method')}>
          Method
        </Link>
        <button className="film-btn" onClick={() => setFilm(true)}>
          <Play size={12} weight="fill" /> <em>Watch the film</em> <span>0:30</span>
        </button>
      </nav>
      <FilmPlayer open={film} onClose={() => setFilm(false)} />
    </header>
  )
}
