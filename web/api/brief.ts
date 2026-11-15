// Vercel serverless function. The Groq key lives only in the GROQ_API_KEY env var, never in the browser.
import { brief } from './_lib/brief'

export async function POST(request: Request) {
  let body: unknown
  try {
    const raw = await request.text()
    if (raw.length > 8000) return Response.json({ error: 'too large' }, { status: 413 })
    body = JSON.parse(raw)
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 })
  }
  const out = await brief(body, process.env.GROQ_API_KEY)
  return Response.json(out.json, { status: out.status, headers: { 'Cache-Control': 'no-store' } })
}
