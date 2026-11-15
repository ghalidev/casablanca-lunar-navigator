// Copies ../contracts/mock into public/mock so the app can fall back to it
// while the pipeline has not produced web/public/data yet. Generated folder: not committed.
import { cpSync, rmSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = join(here, '..', '..', 'contracts', 'mock')
const dst = join(here, '..', 'public', 'mock')
if (!existsSync(src)) {
  console.warn('[sync-mock] contracts/mock not found, skipping')
} else {
  rmSync(dst, { recursive: true, force: true })
  cpSync(src, dst, { recursive: true })
  console.log('[sync-mock] contracts/mock -> public/mock')
}
