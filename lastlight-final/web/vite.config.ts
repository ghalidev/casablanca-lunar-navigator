import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, serve /api/brief through the same code the Vercel function uses.
function devApi(key: string | undefined): Plugin {
  const routes: Record<string, [string, string]> = {
    '/api/brief': ['/api/_lib/brief.ts', 'brief'],
    '/api/copilot': ['/api/_lib/copilot.ts', 'copilot'],
  }
  return {
    name: 'lastlight-dev-api',
    configureServer(server) {
      // Dev only: save a JPEG frame posted by the page (video capture of Mission mode).
      server.middlewares.use('/__capture', async (req, res) => {
        const name = new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? ''
        // Same-origin only: another site open in the browser must not be able to write files here.
        const sameOrigin = req.headers.origin === `http://${req.headers.host}`
        if (req.method !== 'POST' || !sameOrigin || !/^[a-z0-9_-]{1,40}$/.test(name)) {
          res.statusCode = 400
          return res.end()
        }
        let raw = ''
        for await (const chunk of req) raw += chunk
        const b64 = raw.replace(/^data:image\/jpeg;base64,/, '')
        const { writeFileSync, mkdirSync } = await import('node:fs')
        const dir = new URL('../video/public/shots/', import.meta.url)
        mkdirSync(dir, { recursive: true })
        writeFileSync(new URL(`${name}.jpg`, dir), Buffer.from(b64, 'base64'))
        res.end('ok')
      })
      for (const [route, [file, fn]] of Object.entries(routes)) {
        server.middlewares.use(route, async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            return res.end()
          }
          let raw = ''
          for await (const chunk of req) raw += chunk
          let body: unknown = null
          try {
            body = JSON.parse(raw)
          } catch {
            /* handled as invalid input by the handler */
          }
          const mod = await server.ssrLoadModule(file)
          const out = await mod[fn](body, key)
          res.statusCode = out.status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(out.json))
        })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '') // includes non-VITE_ vars, server side only
  return { plugins: [react(), devApi(env.GROQ_API_KEY)] }
})
