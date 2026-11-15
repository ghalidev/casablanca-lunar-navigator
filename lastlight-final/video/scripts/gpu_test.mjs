import puppeteer from 'puppeteer-core'
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader=false', '--window-size=1920,1080', '--hide-scrollbars'],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4173/?clean&ch=moon', { waitUntil: 'networkidle2', timeout: 120000 })
const gl = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl2')
  const e = c.getExtension('WEBGL_debug_renderer_info')
  return c.getParameter(e.UNMASKED_RENDERER_WEBGL)
})
console.log('renderer:', gl)
await new Promise((r) => setTimeout(r, 8000))
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3) }; requestAnimationFrame(f) }))
console.log('fps', fps)
await page.screenshot({ path: 'out/clips/test.png' })
await browser.close()
