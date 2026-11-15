import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { legacyRedirect } from './film/shots'
import { TopBar } from './components/TopBar'
import { useEffect } from 'react'
import { motion } from 'motion/react'
import { MockBanner } from './components/MockBanner'
import { Mission } from './mission/Mission'
import { Method } from './pages/Method'
import { NotFound } from './pages/NotFound'

const NOTICE =
  'NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites. For non-U.S. Government websites, participants must comply with any data use parameters of that specific website.'

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const location = useLocation()
  if (location.pathname === '/') return <Mission />
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
        <Routes location={location}>
          <Route path="/method" element={<Method />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </motion.div>
      </main>
      <footer className="footer">
        <div className="footer-row">
          <span>
            LASTLIGHT by <b>Casablanca, We Have A Solution</b> for NASA Space Apps 2026.
          </span>
          <span>
            Built on LOLA terrain and NAIF SPICE ephemerides.{' '}
            <a href="https://github.com/ShizKN/lastlight">Open source</a>
          </span>
        </div>
        <p className="notice">{NOTICE}</p>
      </footer>
    </>
  )
}
