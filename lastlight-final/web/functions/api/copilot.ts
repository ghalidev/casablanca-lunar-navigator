// Cloudflare Pages Function: same handler as the Vercel function. The Groq key is a Pages secret.
import { copilot } from '../../api/_lib/copilot'

interface Env {
  GROQ_API_KEY?: string
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const raw = await request.text()
  if (raw.length > 2000) return Response.json({ error: 'too large' }, { status: 413 })
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 })
  }
  const out = await copilot(body, env.GROQ_API_KEY)
  return Response.json(out.json, { status: out.status, headers: { 'Cache-Control': 'no-store' } })
}
