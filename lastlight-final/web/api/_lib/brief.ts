import { buildMessages, checkNumbers, templateBrief, validateSheet, type Audience, type BriefResult } from '../../src/ai/facts'

// Workers have no `process`: fall back to the default model there.
const MODEL = (typeof process !== 'undefined' && process.env?.GROQ_MODEL) || 'openai/gpt-oss-120b'
const AUDIENCES: Audience[] = ['kid', 'public', 'planner']

async function callGroq(messages: unknown, key: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, temperature: 0.4, max_tokens: 400, reasoning_effort: 'low' }),
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`groq ${res.status}`)
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  return (j.choices?.[0]?.message?.content ?? '').trim()
}

/** Returns a briefing whose every number is traceable to the fact sheet, or a template fallback. */
export async function brief(body: unknown, key: string | undefined): Promise<{ status: number; json: BriefResult | { error: string } }> {
  const b = body as { sheet?: unknown; audience?: string }
  const sheet = validateSheet(b?.sheet)
  const audience = AUDIENCES.includes(b?.audience as Audience) ? (b!.audience as Audience) : 'public'
  if (!sheet) return { status: 400, json: { error: 'invalid fact sheet' } }

  const fallback = (): BriefResult => {
    const text = templateBrief(sheet)
    return { text, model: 'template', verified: true, fallback: true, numbers: checkNumbers(text, sheet).numbers }
  }
  if (!key) return { status: 200, json: fallback() }

  const messages = buildMessages(sheet, audience)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = (await callGroq(messages, key)).replace(/\s+/g, ' ')
      if (!text || text.length > 600) continue
      const check = checkNumbers(text, sheet)
      if (check.ok) return { status: 200, json: { text, model: MODEL, verified: true, fallback: false, numbers: check.numbers } }
    } catch {
      break
    }
  }
  return { status: 200, json: fallback() }
}
