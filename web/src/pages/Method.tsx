import { motion } from 'motion/react'
import { useSites } from '../data/hooks'

const STEPS = [
  { n: 1, title: 'Laser-mapped terrain', text: 'NASA’s LOLA instrument measured the height of the south pole every few meters. We read that map out to 80° S.' },
  { n: 2, title: 'The skyline from each spot', text: 'From each site we walk outward in 720 directions, up to about 150 km, and keep the highest angle. Moon curvature included.' },
  { n: 3, title: 'Sun and Earth, hour by hour', text: 'NASA’s SPICE ephemerides give where the Sun and Earth are, every hour of every year. We compare them with the skyline.' },
  { n: 4, title: 'A thousand landings', text: 'We scatter virtual landers around the target, tilt them, delay the launch, and track each battery for 14 days.' },
]

function Scatter({ pts }: { pts: { x: number; y: number; name: string }[] }) {
  const S = 260
  return (
    <svg className="scatter" viewBox={`-34 -10 ${S + 50} ${S + 44}`} role="img" aria-label="Our predicted illumination versus LROC observations">
      <rect width={S} height={S} className="frame" />
      <line x1={0} y1={S} x2={S} y2={0} className="diag" />
      {pts.map((p) => (
        <circle key={p.name} cx={(p.x / 100) * S} cy={S - (p.y / 100) * S} r={5} className="pt">
          <title>{p.name}</title>
        </circle>
      ))}
      <text x={S / 2} y={S + 30} textAnchor="middle" className="axis">Seen by LRO cameras (% of time lit)</text>
      <text x={-24} y={S / 2} textAnchor="middle" transform={`rotate(-90 -24 ${S / 2})`} className="axis">LASTLIGHT (%)</text>
    </svg>
  )
}

export function Method() {
  const sites = useSites()
  const pts = (sites.data?.sites ?? [])
    .filter((s) => s.validation.lroc_illum_pct != null && s.validation.model_illum_pct != null)
    .map((s) => ({ x: s.validation.lroc_illum_pct!, y: s.validation.model_illum_pct!, name: s.name }))

  return (
    <section className="page">
      <div className="page-head">
        <p className="kicker">Why trust it</p>
        <h1>Geometry, not guesses.</h1>
        <p className="lead">No machine learning and no made-up scores. Just terrain, orbits and a lot of counting.</p>
      </div>

      <ol className="steps">
        {STEPS.map((s, i) => (
          <motion.li key={s.n} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
            <span className="step-n">{String(s.n).padStart(2, "0")}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </motion.li>
        ))}
      </ol>

      <div className="validate">
        <div>
          <h2>Checked against real photos</h2>
          <p className="lead">
            The LRO Wide Angle Camera photographed the pole 3,807 times over one year. From those photos, LROC mapped how
            often each spot was lit. We run our model over the same year and compare, spot by spot.
          </p>
          <p className="fine">If our dots sit on the diagonal, our skylines are right.</p>
        </div>
        <div className="validate-fig">
          {pts.length ? <Scatter pts={pts} /> : <div className="pending">Comparison not computed yet. It appears here as soon as the pipeline finishes.</div>}
        </div>
      </div>

      <div className="two-col">
        <div>
          <h2 className="section-title">What we don’t model</h2>
          <ul className="plain">
            <li>Temperature. Cold killed Athena too; we only track the battery.</li>
            <li>Rocks and slopes at the meter scale.</li>
            <li>Dust on the panels.</li>
          </ul>
        </div>
        <div>
          <h2 className="section-title">Where AI is used</h2>
          <ul className="plain">
            <li>The copilot is an open model on Groq. It only flies the film: it picks shots and dates, and every number you see comes from our data files. Digits in its replies are removed.</li>
            <li>Code was co-written with Claude Code. The voice in our video is AI-generated.</li>
            <li>No result on this site is produced by AI.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
