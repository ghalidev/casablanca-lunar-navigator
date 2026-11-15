import { motion } from 'motion/react'

// Every statement here describes what the shipped code does (see docs/validation.md, docs/assumptions.md).
const STEPS = [
  { n: 1, title: 'The Moon’s orientation', text: 'For every hour, the Moon’s pole direction and spin come from the IAU lunar rotation model, so we know which way each site faces.' },
  { n: 2, title: 'Sun and Earth, hour by hour', text: 'The astronomy-engine library gives where the Sun and Earth are. We turn that into azimuth and elevation seen from the site, including the Earth parallax (about 0.26°).' },
  { n: 3, title: 'Power and a line home', text: 'The share of the Sun’s disc above the horizon gives sunlight; a vertical panel turned to the Sun gives power. Earth counts when its centre is above the horizon.' },
  { n: 4, title: 'Every landing date, ranked', text: 'For a 6- or 14-day mission we try a landing every 6 hours at every region and rank them: sunlight first, Earth second, long nights penalised.' },
]

const ROWS = [
  { body: 'Sun', what: 'azimuth', max: '0.0037°', mean: '0.0015°' },
  { body: 'Sun', what: 'elevation', max: '0.0006°', mean: '0.0004°' },
  { body: 'Earth', what: 'azimuth', max: '0.0030°', mean: '0.0016°' },
  { body: 'Earth', what: 'elevation', max: '0.0007°', mean: '0.0004°' },
]

export function Method() {
  return (
    <section className="page">
      <div className="page-head">
        <p className="kicker">Why trust it</p>
        <h1>Geometry, not guesses.</h1>
        <p className="lead">No machine learning and no made-up scores. Orbits, the Moon’s rotation and a lot of counting, checked against NASA.</p>
      </div>

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
          <h2>Checked against NASA JPL Horizons</h2>
          <p className="lead">
            We compared our Sun and Earth positions with NASA JPL Horizons, the reference tool of NASA’s Jet Propulsion Laboratory: 4 south-pole
            sites, 3 dates from 2026 to 2028, every hour. 600 comparisons in all.
          </p>
          <p className="fine">The largest difference is 0.004°. The Sun is 0.53° wide. Script and raw results are in the repository (validation/, docs/validation.md).</p>
        </div>
        <div className="validate-fig">
          <table className="method-table">
            <thead>
              <tr>
                <th>Body</th>
                <th>Angle</th>
                <th>Max difference</th>
                <th>Mean</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.body + r.what}>
                  <td>{r.body}</td>
                  <td>{r.what}</td>
                  <td className="num">{r.max}</td>
                  <td className="num">{r.mean}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="two-col">
        <div>
          <h2 className="section-title">What we don’t model yet</h2>
          <ul className="plain">
            <li>Terrain shadows: the horizon is treated as flat. Mountains up to 150 km away can hide a low Sun, so real sites can be darker. NASA LOLA terrain horizons are our next step.</li>
            <li>Exact landing points: each Artemis III region is one point read off NASA’s map (about ±3 km).</li>
            <li>Temperature, dust, rocks and slopes, landing error.</li>
            <li>The 3D relief (×2.5) is a visual from NASA’s CGI Moon Kit (LOLA, LROC); it does not enter the numbers.</li>
          </ul>
        </div>
        <div>
          <h2 className="section-title">Where AI is used</h2>
          <ul className="plain">
            <li>The copilot is an open model on Groq. It only flies the film: it picks shots, regions and dates. Every number comes from our data files, and digits in its replies are removed.</li>
            <li>Code was co-written with Claude Code.</li>
            <li>No result on this site is produced by AI.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
