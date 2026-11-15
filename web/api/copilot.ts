// Vercel serverless function: natural language -> whitelisted UI actions. Key stays server-side.
import { copilot } from './_lib/copilot'

export async function POST(request: Request) {
  let body: unknown
  try {
    const raw = await request.text()
    if (raw.length > 2000) return Response.json({ error: 'too large' }, { status: 413 })
    body = JSON.parse(raw)
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 })
  }
  const out = await copilot(body, process.env.GROQ_API_KEY)
  return Response.json(out.json, { status: out.status, headers: { 'Cache-Control': 'no-store' } })
}
