// Post-build: list every file in dist/assets so the service worker can precache the whole app shell.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dist = new URL('../dist/', import.meta.url).pathname
const assets = readdirSync(join(dist, 'assets')).map((f) => `/assets/${f}`)
const swPath = join(dist, 'sw.js')
const sw = readFileSync(swPath, 'utf8')
const stamp = Date.now().toString(36)
const out = sw.replace("const VERSION = 'gymbook-shell-v1'", `const VERSION = 'gymbook-shell-${stamp}'`).replace('const PRECACHE = []', `const PRECACHE = ${JSON.stringify(assets)}`)
writeFileSync(swPath, out)
console.log(`sw.js: precaching ${assets.length} assets (version ${stamp})`)
