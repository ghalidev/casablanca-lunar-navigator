import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import type { Action, CopilotPlan, SiteId } from './actions'
import { findBest, type Best } from './findBest'
import { loadSeries, loadSites, loadSurvival } from '../data/load'
import { windowStats } from '../data/stats'
import { prettyDate } from '../lib/geo'
import { LABEL } from '../film/shots'
import { useFilm } from '../film/controller'

type Step = { text: string; done: boolean }

// Suggestions follow where you are in the film, so the first thing offered is always the next thing worth asking.
const SUGGEST: Record<string, string[]> = {
  moon: ['Take me to the pole', 'What happened to Athena?', 'Show me the safest windows'],
  athena: ['Where should the next lander go?', 'Show me the safest windows'],
  pole: ['Compare Haworth and Nobile Rim 1', 'Find two weeks of sunlight at Malapert in summer 2027', 'Crash-test the best site'],
  crash: ['Stand on the ground here', 'Crash-test Haworth', 'Compare Haworth and Malapert Massif'],
  site: ['Find the best two weeks here', 'Crash-test this site', 'Show me the safest windows'],
  verdict: ['Crash-test the number one window', 'Compare Haworth and Nobile Rim 1', 'Montre-moi les fenêtres les plus sûres'],
}
const suggestionsFor = (ctx: string) => SUGGEST[ctx.split(':')[0]] ?? SUGGEST.pole

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


// ------------------------------------------------------------------------------------------------ slash commands
// LASTLIGHT's command language. Typed commands run locally and instantly, with no AI in the loop:
//   /tp malapert 2027-10-08      stand on the ground there, that day
//   /crash haworth               1,000 simulated landings
//   /date +7  ·  /date 2027-12-01
//   /stats nobile-rim-2 2027-10-08   numbers straight from the data files
//   /pole ; /date 2027-03-01 ; /best      chain with ;
interface SiteRef { id: string; name: string }
interface Cmd { name: string; args: string; hint: string; sites: 0 | 1 | 2; alias?: string[] }
export const COMMANDS: Cmd[] = [
  { name: 'tp', args: '<region> [date]', hint: 'Teleport to the ground: Sun and Earth over the real skyline', sites: 1, alias: ['ground', 'teleport', 'goto'] },
  { name: 'crash', args: '<region> [date]', hint: 'Drop 1,000 simulated landers, watch 14 days', sites: 1 },
  { name: 'stats', args: '[region] [date]', hint: 'Survival, sunlight, Earth link, longest night: from the data', sites: 1, alias: ['info'] },
  { name: 'best', args: '[region]', hint: 'Safest 2027 landing day, all regions or one', sites: 1, alias: ['safest'] },
  { name: 'date', args: '<YYYY-MM-DD | +N | -N>', hint: 'Set or shift the landing day (film: 2027)', sites: 0, alias: ['time'] },
  { name: 'compare', args: '<region> <region>', hint: 'Two regions side by side', sites: 2, alias: ['vs'] },
  { name: 'pole', args: '', hint: 'The nine Artemis III regions', sites: 0, alias: ['map'] },
  { name: 'athena', args: '', hint: 'Where Athena tipped over, March 2025', sites: 0 },
  { name: 'verdict', args: '', hint: 'Best day of each region', sites: 0, alias: ['top'] },
  { name: 'moon', args: '', hint: 'Back to the whole Moon', sites: 0, alias: ['home'] },
  { name: 'planner', args: '[region] [date]', hint: 'Every landing day 2027–2030, ranked, CSV', sites: 1, alias: ['plan'] },
  { name: 'method', args: '', hint: 'Data, validation, assumptions, limits', sites: 0 },
  { name: 'help', args: '', hint: 'Every command, with examples', sites: 0, alias: ['?'] },
]
const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '')
function matchSite(token: string, sites: SiteRef[]): SiteRef | undefined {
  const t = norm(token)
  if (!t) return undefined
  return sites.find((s) => norm(s.id) === t || norm(s.name) === t) ?? sites.find((s) => norm(s.name).startsWith(t) || norm(s.id).startsWith(t)) ?? sites.find((s) => norm(s.name).includes(t))
}
const findCmd = (w: string) => {
  const k = w.toLowerCase()
  return COMMANDS.find((c) => c.name === k || c.alias?.includes(k)) ?? (k ? COMMANDS.find((c) => c.name.startsWith(k)) : undefined)
}
const ISO = /^\d{4}-\d{2}-\d{2}$/

type Local = { plan: CopilotPlan; nav?: string; stats?: { site?: string; date?: string }; help?: boolean } | { error: string }
/** One command → actions. `today` is the film's landing day (YYYY-MM-DD) for relative dates. */
function parseCommand(text: string, sites: SiteRef[], today: string): Local | null {
  const m = text.trim().match(/^\/(\S*)\s*(.*)$/)
  if (!m) return null
  const cmd = findCmd(m[1])
  if (!cmd) return { error: `Unknown command /${m[1]}. Type /help.` }
  let rest = m[2].trim()
  // An ISO date at the end is the landing day for this command.
  let date: string | undefined
  const dm = rest.match(/(?:^|\s)(\d{4}-\d{2}-\d{2})$/)
  if (dm) {
    date = dm[1]
    rest = rest.slice(0, rest.length - dm[1].length).trim()
  }
  const in2027 = (d?: string) => !d || d.startsWith('2027')
  const one = () => (rest ? matchSite(rest, sites) ?? matchSite(rest.split(/\s+/)[0], sites) : undefined)
  const withDate = (actions: CopilotPlan['actions']): CopilotPlan => ({ say: '', actions: date ? [{ type: 'set_time', date }, ...actions] : actions })
  switch (cmd.name) {
    case 'help':
      return { plan: { say: '', actions: [] }, help: true }
    case 'moon':
    case 'pole':
    case 'athena':
    case 'verdict':
      if (!in2027(date)) return { error: 'The film covers 2027. Use /planner for 2028–2030.' }
      return { plan: withDate([{ type: 'fly', shot: cmd.name }]) }
    case 'planner': {
      const s = one()
      const q = new URLSearchParams()
      if (s) q.set('site', s.id)
      if (date) q.set('date', date)
      return { plan: { say: '', actions: [] }, nav: `/explore${q.toString() ? `?${q}` : ''}` }
    }
    case 'method':
      return { plan: { say: '', actions: [{ type: 'open_method' }] } }
    case 'date': {
      let d = date
      const rel = rest.match(/^([+-])\s*(\d{1,3})\s*d?$/i)
      if (!d && rel) {
        const ms = Date.parse(`${today}T00:00:00Z`) + (rel[1] === '-' ? -1 : 1) * Number(rel[2]) * 86_400_000
        d = new Date(ms).toISOString().slice(0, 10)
      }
      if (!d || !ISO.test(d)) return { error: 'Use /date 2027-10-08, /date +7 or /date -3.' }
      if (!in2027(d)) return { error: 'The film covers 2027. Use /planner for 2028–2030.' }
      return { plan: { say: '', actions: [{ type: 'set_time', date: d }] } }
    }
    case 'tp':
    case 'crash': {
      const s = one()
      if (!s) return { error: `Which region? Try /${cmd.name} malapert` }
      if (!in2027(date)) return { error: `The film covers 2027. Try /planner ${s.id} ${date}` }
      return { plan: withDate([{ type: 'fly', shot: cmd.name === 'tp' ? 'site' : 'crash', site: s.id as SiteId }]) }
    }
    case 'stats': {
      const s = rest ? one() : undefined
      if (rest && !s) return { error: `No region matches “${rest}”.` }
      return { plan: { say: '', actions: [] }, stats: { site: s?.id, date } }
    }
    case 'best': {
      const s = rest ? one() : undefined
      if (rest && !s) return { error: `No region matches “${rest}”.` }
      return { plan: { say: '', actions: [{ type: 'find_best', days: 14, from: '2027-01-01', to: '2027-12-31', need: 'survival', ...(s ? { site: s.id as SiteId } : {}) }] } }
    }
    case 'compare': {
      // Greedy: the longest prefix of words that names a region, then the rest.
      const words = rest.split(/\s+|,|\bvs\b|\band\b/i).filter(Boolean)
      for (let k = 1; k < words.length; k++) {
        const a = matchSite(words.slice(0, k).join(' '), sites)
        const b = matchSite(words.slice(k).join(' '), sites)
        if (a && b && a.id !== b.id) return { plan: withDate([{ type: 'compare', a: a.id as SiteId, b: b.id as SiteId }]) }
      }
      return { error: 'Name two regions, e.g. /compare haworth malapert' }
    }
  }
  return null
}

/** Numbers for /stats, read from the same files the film and the Planner use. */
async function statsFor(siteId: string, date: string) {
  const year = Number(date.slice(0, 4))
  const [surv, series] = await Promise.all([loadSurvival(siteId), loadSeries(siteId, year)])
  const w = surv.windows.find((x) => x.landing_utc.startsWith(date))
  const st = windowStats(series, Date.parse(`${date}T00:00:00Z`), 14)
  return { w, st }
}

/** The mission copilot: one glass bar. Type in your own words, or / for commands. */
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
  const [sites, setSites] = useState<SiteRef[]>([])
  const [sel, setSel] = useState(0)
  const [stats, setStats] = useState<null | { name: string; date: string; p?: number; slip?: number; comm?: number; life?: number; sun: number; earth: number; night: number; silence: number }>(null)
  const [help, setHelp] = useState(false)
  const rec = useRef<SR | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const runId = useRef(0)

  useEffect(() => {
    loadSites()
      .then((d) => setSites(d.sites.map((x) => ({ id: x.id, name: x.name }))))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement
      if (e.key === '/' && !typing) {
        // Like a chat app: "/" anywhere opens the bar with the command list.
        e.preventDefault()
        setText('/')
        setOpen(true)
        input.current?.focus()
      } else if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
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

  // ---- the slash menu: commands first, then region names for the argument
  const slash = text.startsWith('/')
  const m = text.match(/^\/(\S*)(\s+)?(.*)$/)
  const typedCmd = m ? m[1].toLowerCase() : ''
  const cmdChosen = m && m[2] ? findCmd(typedCmd) : undefined
  type Item = { key: string; label: string; hint: string; fill: string; run: boolean }
  let items: Item[] = []
  if (slash && !cmdChosen) {
    items = COMMANDS.filter((c) => c.name.startsWith(typedCmd) || c.alias?.some((a) => a.startsWith(typedCmd))).map((c) => ({ key: c.name, label: `/${c.name}`, hint: c.args ? `${c.args}  ${c.hint}` : c.hint, fill: `/${c.name}${c.args ? ' ' : ''}`, run: !c.args || c.args.startsWith('[') }))
  } else if (cmdChosen && cmdChosen.sites > 0) {
    const arg = m![3] ?? ''
    const words = arg.split(/\s+/)
    const done = cmdChosen.name === 'compare' && words.length > 1 ? words.slice(0, -1).join(' ') : ''
    const last = cmdChosen.name === 'compare' ? words[words.length - 1] ?? '' : arg
    const doneSite = done ? matchSite(done, sites) : undefined
    items = sites
      .filter((x) => !last || norm(x.name).includes(norm(last)) || norm(x.id).startsWith(norm(last)))
      .filter((x) => x.id !== doneSite?.id)
      .map((x) => {
        const second = cmdChosen.name === 'compare' && doneSite
        const fill = `/${cmdChosen.name} ${second ? `${doneSite!.id} ` : ''}${x.id}`
        return { key: x.id, label: x.name, hint: second ? `${doneSite!.name} vs ${x.name}` : `/${cmdChosen.name} ${x.id}`, fill: cmdChosen.name === 'compare' && !second ? fill + ' ' : fill, run: cmdChosen.name !== 'compare' || !!second }
      })
  }
  const menu = open && items.length > 0
  useEffect(() => setSel(0), [text])

  const pick = (it: Item) => {
    if (it.run) {
      setText(it.fill)
      run(it.fill)
    } else {
      setText(it.fill)
      input.current?.focus()
    }
  }

  const tick = (i: number) => setSteps((st) => st.map((x, j) => (j === i ? { ...x, done: true } : x)))

  async function execute(plan: CopilotPlan, id: number) {
    const stale = () => id !== runId.current
    const names = Object.fromEntries(sites.map((x) => [x.id, x.name]))
    setSay(plan.say)
    setSteps([{ text: 'Understanding your request', done: true }, ...plan.actions.map((a) => ({ text: describe(a, names), done: false }))])
    for (let i = 0; i < plan.actions.length; i++) {
      if (stale()) return
      const a = plan.actions[i]
      if (a.type === 'open_method') nav('/method')
      else if (!film) nav(`/?ch=${a.type === 'fly' ? a.shot : 'pole'}${a.type === 'fly' && a.site ? `&site=${a.site}` : ''}`)
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
      if (stale()) return
      tick(i + 1)
    }
  }

  // A finished answer is forgotten as soon as the user comes back to the bar: clean slate, no stale task.
  function reset() {
    runId.current++
    setBusy(false)
    setText('')
    setSteps([])
    setResult(null)
    setSay('')
    setStats(null)
    setHelp(false)
    setError(null)
  }

  async function run(q: string) {
    const query = q.trim()
    if (!query) return
    // A new request replaces the one in progress: the copilot is never locked on a single action.
    const id = ++runId.current
    const stale = () => id !== runId.current
    setError(null)
    setResult(null)
    setSay('')
    setStats(null)
    setHelp(false)
    if (query.startsWith('/')) {
      // A command line: one or more commands separated by ";", run in order.
      const parts = query.split(/\s*;\s*/).filter(Boolean)
      setText('')
      setBusy(true)
      let keepOpen = false
      try {
        for (const part of parts) {
          if (stale()) return
          const today = film?.day?.() ?? '2027-10-08'
          const local = parseCommand(part.startsWith('/') ? part : `/${part}`, sites, today)
          if (!local) continue
          if ('error' in local) {
            setOpen(true)
            setSteps([{ text: part, done: true }])
            setError(local.error)
            return
          }
          if (local.nav) {
            nav(local.nav)
            return
          }
          if (local.help) {
            setOpen(true)
            setSteps([{ text: '/help', done: true }])
            setHelp(true)
            keepOpen = true
            continue
          }
          if (local.stats) {
            const sid = local.stats.site ?? film?.site?.() ?? 'malapert-massif'
            const date = local.stats.date ?? today
            const { w, st } = await statsFor(sid, date)
            if (stale()) return
            const name = sites.find((x) => x.id === sid)?.name ?? sid
            setStats({ name, date, p: w?.p_survive_14d, slip: w?.slip_tolerance_days, comm: w?.p_comm_ok, life: w?.median_days_alive, sun: st.sunPct, earth: st.earthPct, night: st.longestDarkH, silence: st.longestNoEarthH })
            setOpen(true)
            setSteps([{ text: part, done: true }])
            keepOpen = true
            continue
          }
          await execute(local.plan, id)
          if (local.plan.actions.some((a) => a.type === 'find_best')) keepOpen = true
        }
        // A plain fly command needs no panel: the film itself is the answer.
        if (!stale() && !keepOpen) {
          setOpen(false)
          setSteps([])
          input.current?.blur()
        }
      } catch {
        if (!stale()) setError('That data file could not be loaded. Check your connection and try again.')
      } finally {
        if (!stale()) setBusy(false)
      }
      return
    }
    setOpen(true)
    setBusy(true)
    setText('')
    setSteps([{ text: 'Understanding your request', done: false }])
    try {
      const r = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: query, range: DATA_RANGE, context: film?.context() ?? 'method' }),
      })
      if (!r.ok) throw new Error(String(r.status))
      const plan = (await r.json()) as CopilotPlan
      if (stale()) return
      await execute(plan, id)
    } catch {
      if (stale()) return
      setError('The language model is unreachable. The / commands still work offline.')
    } finally {
      if (!stale()) setBusy(false)
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

  const showPanel = open && !menu && (steps.length > 0 || !text)
  return (
    <div className={'copilot-dock' + (open ? ' open' : '') + (busy ? ' busy' : '')}>
      <AnimatePresence>
        {menu && (
          <motion.ul
            key="menu"
            className="copilot-menu"
            role="listbox"
            initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {items.slice(0, 9).map((it, i) => (
              <li key={it.key} role="option" aria-selected={i === sel}>
                <button type="button" className={i === sel ? 'on' : ''} onMouseEnter={() => setSel(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(it)}>
                  <b>{it.label}</b>
                  <span>{it.hint}</span>
                </button>
              </li>
            ))}
            <li className="copilot-menu-foot" aria-hidden="true">
              <kbd>↑</kbd>
              <kbd>↓</kbd> choose <kbd>tab</kbd> complete <kbd>↵</kbd> run
            </li>
          </motion.ul>
        )}
        {showPanel && (
          <motion.div key="panel" className="copilot-panel" initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: 6, filter: 'blur(4px)' }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
            {steps.length === 0 ? (
              <div className="copilot-examples">
                {suggestionsFor(film?.context() ?? 'pole').map((e) => (
                  <button
                    key={e}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => {
                      setText(e)
                      run(e)
                    }}
                  >
                    {e}
                  </button>
                ))}
                <button className="slash" onMouseDown={(ev) => ev.preventDefault()} onClick={() => { setText('/'); input.current?.focus() }}>
                  <b>/</b> commands
                </button>
              </div>
            ) : (
              <>
                {say && <p className="copilot-say">{say}</p>}
                {busy && !result && <p className="copilot-working">{steps.find((x) => !x.done)?.text ?? 'Working'}…</p>}
                {result && (
                  <div className="copilot-result">
                    Best in {result.date.slice(0, 4)}: <b>{result.siteName}</b>, landing {day(result.date)}, {result.days} days: <span className="num">{Math.round(result.value)}%</span> {result.label}.
                  </div>
                )}
                {stats && (
                  <div className="copilot-stats">
                    <p>
                      <b>{stats.name}</b>, landing {day(stats.date)}, 14 days
                    </p>
                    <dl className="num">
                      <div><dt>Survive 14 d</dt><dd className="hl">{stats.p != null ? `${(stats.p * 100).toFixed(1)}%` : 'n/a'}</dd></div>
                      <div><dt>Median life</dt><dd>{stats.life != null ? `${stats.life.toFixed(1)} d` : 'n/a'}</dd></div>
                      <div><dt>Later days ≥ 95%</dt><dd>{stats.slip != null ? `${stats.slip} d` : 'n/a'}</dd></div>
                      <div><dt>Sun in view</dt><dd>{Math.round(stats.sun)}%</dd></div>
                      <div><dt>Earth in view</dt><dd>{Math.round(stats.earth)}%</dd></div>
                      <div><dt>Longest night</dt><dd>{Math.round(stats.night)} h</dd></div>
                    </dl>
                  </div>
                )}
                {help && (
                  <ul className="copilot-help">
                    {COMMANDS.map((c) => (
                      <li key={c.name}>
                        <code>
                          /{c.name}
                          {c.args ? ` ${c.args}` : ''}
                        </code>
                        <span>{c.hint}</span>
                      </li>
                    ))}
                    <li className="ex">
                      <code>/tp malapert 2027-10-08 ; /stats</code>
                      <span>chain commands with ;</span>
                    </li>
                  </ul>
                )}
                {error && <p className="copilot-error">{error}</p>}
              </>
            )}
            <button
              className="copilot-close"
              onClick={() => {
                reset()
                setOpen(false)
              }}
              aria-label="Close"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <form
        className="copilot-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (menu && items[sel] && (items[sel].run || !cmdChosen)) return pick(items[sel])
          run(text)
        }}
      >
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => {
            if (!busy && steps.length) reset()
            setOpen(true)
          }}
          onBlur={() => window.setTimeout(() => !busy && !steps.length && setOpen(false), 120)}
          onKeyDown={(e) => {
            if (!menu) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSel((v) => (v + 1) % Math.min(9, items.length))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSel((v) => (v - 1 + Math.min(9, items.length)) % Math.min(9, items.length))
            } else if (e.key === 'Tab') {
              e.preventDefault()
              setText(items[sel].fill)
            }
          }}
          placeholder="Ask about a landing, or type /"
          aria-label="Ask the mission copilot"
          autoComplete="off"
          spellCheck={false}
        />
        {!text && <kbd>/</kbd>}
        <button type="button" className={'mic' + (listening ? ' on' : '')} onClick={listen} aria-label="Speak">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </button>
        <button type="submit" className="go" disabled={!text.trim()} aria-label="Run">
          {busy ? <span className="spinner" /> : '→'}
        </button>
      </form>
    </div>
  )
}
