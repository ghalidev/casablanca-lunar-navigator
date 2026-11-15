// Records the real 3D film, on the GPU, shot by shot: video/out/clips/<name>.mp4 (1920x1080).
// Usage: node scripts/capture.mjs [name ...]   (server: cd web && npx vite preview --port 4173)
import puppeteer from 'puppeteer-core'

const BASE = 'http://127.0.0.1:4173/'
const SITE = 'malapert-massif'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const only = process.argv.slice(2)

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1920,1080', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
})

// Malapert Massif's best 2027 window (top10.json): the crash shot replays that landing day.
const DATE = '2027-10-08'

async function open(ch) {
  const page = await browser.newPage()
  await page.goto(`${BASE}?clean&ch=${ch}&site=${SITE}&date=${DATE}`, { waitUntil: 'networkidle2', timeout: 120000 })
  await page.waitForFunction(() => !document.querySelector('.mm-veil:not(.gone)'), { timeout: 120000 })
  await wait(5000)
  return page
}

async function rec(page, name, fn) {
  const rec = await page.screencast({ path: `out/clips/${name}.mp4`, speed: 1 })
  const t0 = Date.now()
  await fn()
  await rec.stop()
  console.log(name, ((Date.now() - t0) / 1000).toFixed(1), 's')
}
const next = (page) => page.keyboard.press('ArrowRight')

const shots = {
  async moon() {
    const p = await open('moon')
    await rec(p, 'moon', () => wait(8000))
    await p.close()
  },
  async athena() {
    const p = await open('moon')
    await next(p)
    await wait(300)
    await rec(p, 'athena', () => wait(9000))
    await p.close()
  },
  async pole() {
    const p = await open('athena')
    await next(p)
    await wait(3600)
    await rec(p, 'pole', async () => {
      await wait(1500)
      await p.evaluate(() => new Promise((res) => {
        const t0 = performance.now(), from = 8, to = 300, dur = 5500
        const f = (t) => { const k = Math.min(1, (t - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; window.__ll.setDay(from + (to - from) * e); k < 1 ? requestAnimationFrame(f) : res() }
        requestAnimationFrame(f)
      }))
      await wait(1500)
    })
    await p.close()
  },
  async crash() {
    const p = await open('pole')
    await next(p)
    await wait(300)
    await rec(p, 'crash', () => wait(14000))
    await p.close()
  },
  async site() {
    const p = await open('crash')
    await wait(2000)
    await next(p)
    await wait(300)
    await rec(p, 'site', () => wait(10000))
    await p.close()
  },
  async verdict() {
    const p = await open('site')
    await next(p)
    await wait(300)
    await rec(p, 'verdict', () => wait(6000))
    await p.close()
  },
}
for (const [n, f] of Object.entries(shots)) if (!only.length || only.includes(n)) await f()
await browser.close()
