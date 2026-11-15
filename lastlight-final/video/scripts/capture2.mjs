// Records the real app (new palette, real data) for the cinematic cut: video/public/clips2/<name>.mp4, 1920x1080.
// Usage: (cd web && npx vite preview --port 4173) then  node scripts/capture2.mjs [name ...]
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'

const BASE = 'http://localhost:4173/'
const OUT = 'public/clips2'
fs.mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const only = process.argv.slice(2)

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1920,1080', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
})

async function open(query, { veil = true } = {}) {
  const page = await browser.newPage()
  await page.goto(`${BASE}${query}`, { waitUntil: 'networkidle2', timeout: 120000 })
  if (veil) await page.waitForFunction(() => !document.querySelector('.mm-veil:not(.gone)'), { timeout: 120000 })
  await wait(4500)
  return page
}

async function rec(page, name, fn) {
  const r = await page.screencast({ path: `${OUT}/${name}.mp4`, speed: 1 })
  const t0 = Date.now()
  await fn()
  await r.stop()
  console.log(name, ((Date.now() - t0) / 1000).toFixed(1), 's')
}
const next = (page) => page.keyboard.press('ArrowRight')

// Malapert Massif's best 2027 landing day (top10.json) and Nobile Rim 2's ridge moment (explainer.json, hour 6930 of 2027).
const shots = {
  async moon() {
    const p = await open('?clean&ch=moon&date=2027-10-08')
    await rec(p, 'moon', () => wait(9000))
    await p.close()
  },
  async athena() {
    const p = await open('?clean&ch=moon&date=2027-10-08')
    await next(p)
    await wait(200)
    await rec(p, 'athena', () => wait(9500))
    await p.close()
  },
  async ground() {
    const p = await open('?clean&play&ch=site&site=malapert-massif&date=2027-10-08&t=6744')
    await rec(p, 'ground', () => wait(10000))
    await p.close()
  },
  async ridge() {
    const p = await open('?clean&play&ch=site&site=nobile-rim-2&date=2027-10-16&t=6880')
    await rec(p, 'ridge', () => wait(9000))
    await p.close()
  },
  async crash() {
    const p = await open('?clean&ch=pole&site=malapert-massif&date=2027-10-08')
    await next(p)
    await wait(200)
    await rec(p, 'crash', () => wait(15000))
    await p.close()
  },
  async pole() {
    const p = await open('?clean&ch=athena&site=malapert-massif&date=2027-10-08')
    await next(p)
    await wait(3800)
    await rec(p, 'pole', async () => {
      await wait(1200)
      await p.evaluate(
        () =>
          new Promise((res) => {
            const t0 = performance.now(), from = 200, to = 280, dur = 6000
            const f = (t) => {
              const k = Math.min(1, (t - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
              window.__ll.setDay(from + (to - from) * e)
              k < 1 ? requestAnimationFrame(f) : res()
            }
            requestAnimationFrame(f)
          }),
      )
      await wait(1200)
    })
    await p.close()
  },
  async planner() {
    const p = await open('explore?site=malapert-massif&date=2027-10-08', { veil: false })
    await wait(4000)
    await rec(p, 'planner', async () => {
      await wait(800)
      await p.click('.pl-scrub .pl-ib.play')
      await wait(7000)
    })
    await p.close()
  },
  async command() {
    const p = await open('?ch=pole&site=malapert-massif&date=2027-10-08')
    await rec(p, 'command', async () => {
      await wait(700)
      await p.keyboard.press('/')
      await wait(700)
      for (const ch of 'tp malapert 2027-10-08') {
        await p.keyboard.type(ch)
        await wait(55)
      }
      await wait(500)
      await p.keyboard.press('Enter')
      await wait(6500)
    })
    await p.close()
  },
}
for (const [n, f] of Object.entries(shots)) if (!only.length || only.includes(n)) await f()
await browser.close()
