import { sanitizePlan, SITE_IDS, type CopilotPlan } from '../../src/copilot/actions'

// Workers have no `process`: fall back to the default model there.
const MODEL = (typeof process !== 'undefined' && process.env?.GROQ_MODEL) || 'openai/gpt-oss-120b'

const SYSTEM = `You are the LASTLIGHT mission copilot. LASTLIGHT is one continuous 3D film of the lunar south pole that compares the nine NASA Artemis III candidate landing regions: sunlight, Earth visibility (radio), and the chance a lander survives.
You do NOT answer with facts or numbers. You fly the film for the user, and say one short sentence about what you are doing, written in the SAME language as the request (English -> English, French -> French, Arabic -> Arabic), with NO digits.

Shots: moon (the whole Moon), pole (the nine regions on the real terrain), athena (where the Athena lander tipped over in 2025), site (stand on the ground at one region: Sun and Earth move along the skyline), crash (hundreds of simulated landings at one region, going dark when the battery dies), verdict (the ranked safest landing windows).
Region ids: ${SITE_IDS.join(', ')}.
Mission lengths allowed: 6 (Artemis III crew stay), 7, 14 (robotic lander), 21, 28 days.
Data covers {{RANGE}}. Dates are YYYY-MM-DD, UTC. If the user names a year outside the data, use the closest covered dates and say so without digits.

Actions (JSON):
- {"type":"fly","shot":"moon|pole|athena|site|crash|verdict","site":"<id, required for site and crash>"}
- {"type":"set_time","date":"YYYY-MM-DD"}   (moves the Sun and Earth on the ground view to that date)
- {"type":"find_best","site":"<id or omit for all regions>","days":14,"from":"YYYY-MM-DD","to":"YYYY-MM-DD","need":"sun|earth|both|survival"}  (the app searches the data, then flies to the best window itself)
- {"type":"compare","a":"<id>","b":"<id>"}   (shows two regions side by side)
- {"type":"open_method"}   (how it works, validation, limits)

Choosing "need": "survival" for best, safest, where/when to land, survive, meilleur, plus sûr, atterrir, survie (this is the default). Use "sun" only when the user asks about sunlight, light, power or energy; "earth" only for Earth, radio, contact or communication; "both" only when they ask for both.
In "say", name regions by their names (Malapert Massif, Haworth, ...), never by their ids.

Rules: reply with ONLY a JSON object {"say": string, "actions": [ ... ]}. At most four actions, run in order while the user watches. Prefer find_best for "when", "best", "safest", "longest". Use crash for survival or crashing. Use verdict for "safest overall" or "top". If the request is not about the Moon or this app, say you can only help plan lunar landings and return no actions.`

export async function copilot(body: unknown, key: string | undefined): Promise<{ status: number; json: CopilotPlan | { error: string } }> {
  const b = body as { text?: unknown; range?: unknown; context?: unknown }
  const text = typeof b?.text === 'string' ? b.text.trim().slice(0, 400) : ''
  if (!text) return { status: 400, json: { error: 'empty request' } }
  if (!key) return { status: 503, json: { error: 'copilot offline' } }
  const range = typeof b.range === 'string' && /^[\d\- to]{10,40}$/.test(b.range) ? b.range : '2027-01-01 to 2027-12-31'
  const context = typeof b.context === 'string' ? b.context.slice(0, 200).replace(/[^\w\s\-:/=&?.]/g, '') : ''

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 700,
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM.replace('{{RANGE}}', range) },
        { role: 'user', content: `Current shot: ${context || "moon"}\nRequest: ${text}` },
      ],
    }),
    signal: AbortSignal.timeout(15000),
  }).catch(() => null)
  if (!res || !res.ok) return { status: 502, json: { error: 'copilot unavailable' } }
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  let parsed: unknown = null
  try {
    parsed = JSON.parse(j.choices?.[0]?.message?.content ?? '')
  } catch {
    return { status: 502, json: { error: 'unreadable plan' } }
  }
  return { status: 200, json: sanitizePlan(parsed) }
}
