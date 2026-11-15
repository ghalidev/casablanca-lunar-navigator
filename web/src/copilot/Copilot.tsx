import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { Action, CopilotPlan } from './actions'
import { findBest, type Best } from './findBest'
import { loadSites } from '../data/load'
import { prettyDate } from '../lib/geo'
import { LABEL } from '../film/shots'
import { useFilm } from '../film/controller'

type Step = { text: string; done: boolean }

const EXAMPLES = [
  'Find two weeks of sunlight at Malapert in summer 2027',
  'Crash-test a lander at Haworth',
  'Compare Haworth and Nobile Rim 1',
  'Montre-moi les fenêtres les plus sûres',
]

const DATA_RANGE = '2027-01-01 to 2027-12-31'

// Minimal typing for the Web Speech API (not in the TS DOM lib everywhere).
type SR = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; start: () => void; stop: () => void }
const speechCtor = (): (new () => SR) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const day = (d: string) => prettyDate(Date.parse(d + 'T00:00:00Z'))

function describe(a: Action, names: Record<string, string>): string {
  switch (a.type) {
    case 'fly':
      return `Fly to ${LABEL[a.shot].toLowerCase()}${a.site ? `, ${names[a.site] ?? a.site}` : ''}`
    case 'set_time':
      return `Set the clock to ${day(a.date)}`
    case 'find_best':
      return `Search ${a.site ? names[a.site] : 'all nine regions'}, ${day(a.from)} to ${day(a.to)}`
    case 'compare':
      return `Compare ${names[a.a]} and ${names[a.b]}`
    case 'open_method':
      return 'Open the method'
  }
}

/** The mission copilot: one bar, it flies the film while you watch. Press / or ⌘K. */
export function Copilot() {
  const nav = useNavigate()
  const film = useFilm()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [say, setSay] = useState('')
  const [steps, setSteps] = useState<Step[]>([])
  const [result, setResult] = useState<Best | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const rec = useRef<SR | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement
      if ((e.key === '/' && !typing) || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault()
        setOpen(true)
        input.current?.focus()
      }
      if (e.key === 'Escape') {
        setOpen(false)
        input.current?.blur()
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  const tick = (i: number) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, done: true } : x)))

  async function run(q: string) {
    const query = q.trim()
    if (!query || busy) return
    setOpen(true)
    setBusy(true)
    setError(null)
    setResult(null)
    setSay('')
    setSteps([{ text: 'Understanding your request', done: false }])
    try {
      const r = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: query, range: DATA_RANGE, context: film?.context() ?? 'method' }),
      })
      if (!r.ok) throw new Error(String(r.status))
      const plan = (await r.json()) as CopilotPlan
      const sites = await loadSites()
      const names = Object.fromEntries(sites.sites.map((s) => [s.id, s.name]))
      setSay(plan.say)
      setSteps([{ text: 'Understanding your request', done: true }, ...plan.actions.map((a) => ({ text: describe(a, names), done: false }))])
      for (let i = 0; i < plan.actions.length; i++) {
        const a = plan.actions[i]
        if (a.type === 'open_method') nav('/method')
        else if (!film) nav(`/?ch=${a.type === 'fly' ? a.shot : 'pole'}`)
        else if (a.type === 'fly') await film.fly(a.shot, a.site)
        else if (a.type === 'set_time') film.setTime(a.date)
        else if (a.type === 'compare') await film.compare(a.a, a.b)
        else if (a.type === 'find_best') {
          const best = await findBest({ site: a.site, days: a.days, from: a.from, to: a.to, need: a.need })
          if (!best) setError('No data covers those dates yet.')
          else {
            setResult(best)
            film.setTime(best.date)
            await film.fly(best.need === 'survival' ? 'crash' : 'site', best.siteId)
          }
        }
        tick(i + 1)
      }
    } catch {
      setError('The copilot is offline. Every shot still works from the rail on the right.')
    } finally {
      setBusy(false)
    }
  }

  function listen() {
    const Ctor = speechCtor()
    if (!Ctor) return setError('Voice input is not supported in this browser.')
    if (listening) return rec.current?.stop()
    const r = new Ctor()
    r.lang = navigator.language || 'en-US'
    r.interimResults = false
    r.onresult = (e) => {
      const t = e.results[0][0].transcript
      setText(t)
      run(t)
    }
    r.onend = () => setListening(false)
    rec.current = r
    setListening(true)
    r.start()
  }

  return (
    <div className={'copilot-dock' + (open ? ' open' : '')}>
      <AnimatePresence>
        {open && (
          <motion.div className="copilot-panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18 }}>
            {steps.length === 0 ? (
              <div className="copilot-examples">
                <p>Say what you need. The copilot flies the film for you.</p>
                {EXAMPLES.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setText(e)
                      run(e)
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            ) : (
              <>
                {say && <p className="copilot-say">{say}</p>}
                <ol className="copilot-steps">
                  {steps.map((s, i) => (
                    <li key={i} className={s.done ? 'done' : ''}>
                      <span className="tick" />
                      {s.text}
                    </li>
                  ))}
                </ol>
                {result && (
                  <div className="copilot-result">
                    <b>{result.siteName}</b>, landing {day(result.date)}, {result.days} days: <span className="num">{Math.round(result.value)}%</span> {result.label}.
                    <small>Found by searching our data, not by the AI.</small>
                  </div>
                )}
                {error && <p className="copilot-error">{error}</p>}
              </>
            )}
            <button className="copilot-close" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <form
        className="copilot-form"
        onSubmit={(e) => {
          e.preventDefault()
          run(text)
        }}
      >
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Ask the copilot to fly somewhere"
          aria-label="Ask the mission copilot"
        />
        <kbd>/</kbd>
        <button type="button" className={'mic' + (listening ? ' on' : '')} onClick={listen} aria-label="Speak">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </button>
        <button type="submit" className="go" disabled={busy || !text.trim()} aria-label="Run">
          {busy ? <span className="spinner" /> : '→'}
        </button>
      </form>
    </div>
  )
}
