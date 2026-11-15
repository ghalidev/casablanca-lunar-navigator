import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { COMMANDS } from '../copilot/Copilot'

// Every statement here describes what the shipped pipeline does (pipeline/, docs/assumptions.md, docs/validation.md).
const STEPS = [
  { n: 1, title: 'Laser-mapped skyline', text: 'NASA LOLA terrain, 20 m per pixel near each site and 240 m out to 150 km. From each site we scan 720 directions and keep the highest ridge, with the Moon’s curvature.' },
  { n: 2, title: 'Sun and Earth, hour by hour', text: 'NASA SPICE ephemerides through Skyfield give where the Sun and Earth are every hour from 2027 to 2030, including the Earth’s parallax (up to 0.26°).' },
  { n: 3, title: 'A thousand landings per day', text: 'For every landing day we drop 1,000 virtual landers around the target: position error, the real slope under each one, a tip-over limit, then 14 days of panel power against a battery.' },
  { n: 4, title: 'The safest windows', text: 'A window counts when at least 95% of its landers are still alive after 14 days. The ranking is that probability, then how many days the launch could slip.' },
]

// The case in one screen. Every figure comes from the pipeline outputs (web/public/data) or the published mission record.
const PROOF = [
  { n: '13,023,000', l: 'simulated landings: 1,000 landers × 1,447 days × 9 regions' },
  { n: '96.4%', l: 'best 14-day power survival found (generic lander, 964 of 1,000 draws, 95% interval 95.1–97.4%): Malapert Massif, 15 Oct 2029' },
  { n: '0.014°', l: 'largest gap on the Sun and Earth vs an independent calculator, itself within 0.004° of NASA JPL Horizons' },
]
const RECORD = [
  'Athena (IM-2) reached Mons Mouton on 6 March 2025, landed on its side and went dark in under 13 hours: its panels could not see the Sun.',
  'Odysseus (IM-1, 2024) landed tilted; its panels could not face the Sun. Six days of operations.',
  'Of the first four landers NASA sent through its commercial CLPS program, to March 2025: one upright, two on their side, one never arrived.',
]
const FIT = [
  ['Compare landing sites', 'The nine Artemis III regions on real NASA terrain, ranked, side by side for any day'],
  ['Compare landing dates', 'Every day 2027–2030 on a calendar: tap one, get the verdict'],
  ['Sun and Earth vs the horizon', 'The computed 360° skyline with the Sun and Earth moving over it, hour by hour, in 2D and 3D'],
  ['Solar power', 'Visible fraction of the Sun’s disc every hour; a battery followed for 14 days per lander'],
  ['Talking to Earth', 'Earth in view every hour; the longest radio silence'],
  ['For planners, teachers, everyone', 'CSV and shareable links; a 3D film with one short sentence per screen'],
  ['Beyond the brief', 'Survival under landing error, slope, tip-over and launch delay, not just “is it sunny”'],
]

const CHECKS = [
  { what: 'Sun and Earth angles vs NASA JPL Horizons', result: '0.004° max', note: '600 comparisons, 4 sites (team calculator)' },
  { what: 'Our SPICE/Skyfield series vs the team’s independent calculator', result: '0.014° max', note: 'every hour of 2027, 3 sites' },
  { what: 'Site heights from our 20 m terrain vs the team’s 474 m grid', result: '27 m max', note: '9 regions' },
  { what: 'Landers alive in the crash test vs the survival chance on the pole', result: 'identical', note: 'every day of 2027, 9 regions, same 1,000 draws (automated test)' },
]

export function Method() {
  const { hash } = useLocation()
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])
  return (
    <section className="page">
      <div className="page-head">
        <h1>Land where the light lasts.</h1>
        <p className="lead">One ridge in the wrong place and a lander goes dark. We tell you, before launch, if yours survives.</p>
      </div>

      <div className="proof">
        {PROOF.map((p) => (
          <div key={p.n}>
            <b className="num">{p.n}</b>
            <span>{p.l}</span>
          </div>
        ))}
      </div>

      <ul className="builton" aria-label="Built on">
        <li><small>Terrain</small><b>NASA LRO · LOLA</b></li>
        <li><small>Sun and Earth</small><b>NASA/JPL · NAIF SPICE</b></li>
        <li><small>Landing regions</small><b>NASA Artemis III · 9 candidates</b></li>
        <li><small>Made for</small><b>NASA Space Apps Challenge 2026</b></li>
      </ul>

      <div className="two-col">
        <div>
          <h2 className="section-title">Why it matters</h2>
          <ul className="plain">
            {RECORD.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p className="fine">NASA’s Artemis III crew is headed to one of these nine regions. Every robotic lander before them faces the same question: will it see the Sun long enough?</p>
        </div>
        <div>
          <h2 className="section-title">What the challenge asks, what LASTLIGHT does</h2>
          <table className="method-table fit-table">
            <tbody>
              {FIT.map(([a, b]) => (
                <tr key={a}>
                  <td>{a}</td>
                  <td>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="section-title">How it works</h2>

      <ol className="steps">
        {STEPS.map((s, i) => (
          <motion.li key={s.n} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
            <span className="step-n">{String(s.n).padStart(2, '0')}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </motion.li>
        ))}
      </ol>

      <div className="validate">
        <div>
          <h2>Checked against independent sources</h2>
          <p className="lead">Two separate codebases compute where the Sun and Earth are. They agree to a hundredth of a degree, and both match NASA’s own Horizons service.</p>
          <p className="fine">Not done yet: the pixel-by-pixel comparison with the LROC illumination map (3,807 photos). Our skyline and the team’s 474 m terrain agree in shape but differ by about 0.3 to 2.5° on average, so skyline accuracy is the next thing to prove.</p>
        </div>
        <div className="validate-fig">
          <table className="method-table">
            <thead>
              <tr>
                <th>Check</th>
                <th>Largest difference</th>
              </tr>
            </thead>
            <tbody>
              {CHECKS.map((r) => (
                <tr key={r.what}>
                  <td>
                    {r.what}
                    <br />
                    <small style={{ color: 'var(--muted)' }}>{r.note}</small>
                  </td>
                  <td className="num">{r.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="two-col">
        <div>
          <h2 className="section-title">What we don’t model</h2>
          <ul className="plain">
            <li>The survival % is a power-survival index for comparing places and days: the share of 1,000 simulated landings whose battery lasts 14 days. It is not the chance that a real mission succeeds.</li>
            <li>Temperature, heat loss, battery fade in the cold, part temperature limits. Cold killed Athena too. In the Planner you can add a night-time heater draw to see what it costs; that is a proxy, not a thermal model.</li>
            <li>The lander is generic (four vertical panels, 2.5 kWh, 60 W), not any real vehicle. In the Planner you can enter your own battery, load and panels; a sensitivity study shows the site ranking holds in 7 of 8 variants.</li>
            <li>Tip-over is a simple 15° limit (10° and 20° tested).</li>
            <li>Region positions are digitized by hand from NASA’s map (no coordinates are published), good to about 3 km.</li>
            <li>The terrain light is not yet compared pixel by pixel with LROC photos. Sun and Earth positions are checked; the skyline is not, yet.</li>
            <li>Rocks and slopes under 20 m, dust on panels.</li>
          </ul>
        </div>
        <div>
          <h2 className="section-title">Where AI is used</h2>
          <ul className="plain">
            <li>The copilot is an open model on Groq. It only flies the film: it picks shots, regions and dates. Every number comes from our data files, and digits in its replies are removed.</li>
            <li>Code was co-written with Claude Code. The voice in our video is AI-generated.</li>
            <li>No result on this site is produced by AI.</li>
          </ul>
        </div>
      </div>

      <div className="cmds">
        <h2 className="section-title">The command language</h2>
        <p className="cmds-lead">Press <kbd>/</kbd> anywhere in the film. Commands run in your browser, on the same data files, with no AI involved. Chain them with <code>;</code>.</p>
        <table className="method-table cmds-table">
          <tbody>
            {COMMANDS.map((c) => (
              <tr key={c.name}>
                <td>
                  <code>
                    /{c.name}
                    {c.args ? ` ${c.args}` : ''}
                  </code>
                </td>
                <td>{c.hint}</td>
              </tr>
            ))}
            <tr>
              <td>
                <code>/tp malapert 2027-10-08 ; /stats</code>
              </td>
              <td>Stand at Malapert on 8 October 2027, then read its numbers</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="team" id="team">
        <p className="callsign">
          <span>“Houston, we have a problem.”</span>
          <b>From Casablanca, we have a solution.</b>
        </p>
        <p className="callsign-note">Our team name answers the most famous line of Apollo 13. Two landers went dark at the south pole; LASTLIGHT is our answer, from Morocco.</p>
        <p>
          LASTLIGHT is built in Casablanca by <b>Adam</b>, <b>Ghali</b> and <b>Yassine</b>, team <b>Casablanca, We Have A Solution</b> (CWS), for the NASA Space Apps Challenge 2026. Everything is open source:{' '}
          <a href="https://github.com/ghalidev/casablanca-lunar-navigator" target="_blank" rel="noreferrer">
            github.com/ghalidev/casablanca-lunar-navigator
          </a>
          .
        </p>
      </div>
    </section>
  )
}
