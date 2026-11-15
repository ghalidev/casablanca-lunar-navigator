import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
const svg = fs.readFileSync(process.argv[2], 'utf8')
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' })
for (const [size, out, bg] of [[32, 'favicon-32.png', null], [180, 'apple-touch-icon.png', '#07080b'], [512, 'icon-512.png', '#07080b']]) {
  const p = await b.newPage()
  await p.setViewport({ width: size, height: size })
  const pad = bg ? Math.round(size * 0.16) : 0
  await p.setContent(`<html><body style="margin:0;background:${bg ?? 'transparent'}"><div style="width:${size}px;height:${size}px;display:grid;place-items:center"><div style="width:${size - 2 * pad}px;height:${size - 2 * pad}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body></html>`)
  await p.screenshot({ path: `${process.argv[3]}/${out}`, omitBackground: !bg })
}
await b.close()
