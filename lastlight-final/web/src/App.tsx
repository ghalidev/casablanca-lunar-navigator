import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { legacyRedirect } from './film/shots'
import { TopBar } from './components/TopBar'
import { Suspense, lazy, useEffect } from 'react'
import { motion } from 'motion/react'
import { MockBanner } from './components/MockBanner'
// One chunk per page: the Planner and Method never download the 3D film's code.
const Mission = lazy(() => import('./mission/Mission').then((m) => ({ default: m.Mission })))
const Method = lazy(() => import('./pages/Method').then((m) => ({ default: m.Method })))
const Explore = lazy(() => import('./pages/Explore').then((m) => ({ default: m.Explore })))
const Wait = () => (
  <div className="boot" role="status" aria-label="Loading">
    <svg viewBox="0 0 220 80" aria-hidden="true">
      <line className="hz" x1="0" y1="58" x2="220" y2="58" />
      <g className="sun">
        <circle r="7" />
      </g>
      <path className="ridge" d="M0 80 V60 L24 54 L40 57 L58 44 L74 50 L92 41 L110 52 L128 47 L146 55 L162 46 L180 53 L198 50 L220 58 V80 Z" />
      <path className="crest" d="M0 60 L24 54 L40 57 L58 44 L74 50 L92 41 L110 52 L128 47 L146 55 L162 46 L180 53 L198 50 L220 58" />
    </svg>
  </div>
)
import { NotFound } from './pages/NotFound'
import { NOTICE } from './components/notice'

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const location = useLocation()
  if (location.pathname === '/')
    return (
      <Suspense fallback={<Wait />}>
        <Mission />
      </Suspense>
    )
  if (location.pathname === '/explore')
    return (
      <Suspense fallback={<Wait />}>
        <Explore />
      </Suspense>
    )
  // The old tool pages are shots of the film now.
  const to = legacyRedirect(location.pathname, location.search)
  if (to) return <Navigate to={to} replace />
  return (
    <>
      <ScrollTop />
      <MockBanner />
      <TopBar />
      <main>
        {/* Enter-only transition: never blocks navigation waiting for an exit animation. */}
        <motion.div key={location.pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
        <Suspense fallback={<Wait />}>
          <Routes location={location}>
            <Route path="/method" element={<Method />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        </motion.div>
      </main>
      <footer className="footer">
        <div className="footer-row">
          <span>
            LASTLIGHT by <b>Casablanca, We Have A Solution</b> (CWS): Adam, Ghali and Yassine. NASA Space Apps Challenge 2026.
          </span>
          <span>
            Built on LOLA terrain and NAIF SPICE ephemerides.{' '}
            <a href="https://github.com/ghalidev/casablanca-lunar-navigator">Open source</a>
          </span>
        </div>
        <p className="notice">{NOTICE}</p>
      </footer>
    </>
  )
}
