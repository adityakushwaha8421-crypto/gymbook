import { test, expect, chromium, type Page } from '@playwright/test'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { statSync, writeFileSync, readFileSync } from 'node:fs'
import { onboard } from '../e2e/helpers'
import { FakeDrive, mockGoogle, setGoogle } from '../e2e/google'
import { generate, TIERS, type Generated } from './generate'

/**
 * Volume test: load a large made-up gym and time what a person at the front desk does.
 * Run with `npm run test:volume` (VOLUME_TIER=busy|large|huge, default busy). It is kept out of
 * the normal test run because one pass takes minutes and writes files of tens to hundreds of MB.
 *
 * Google Drive is the same stand-in the other browser tests use, reached over a local HTTP server
 * so that a backup of any size passes through a real network request.
 */

const tier = TIERS[process.env.VOLUME_TIER ?? 'busy']
if (!tier) throw new Error(`Unknown VOLUME_TIER ${process.env.VOLUME_TIER}`)
const LONG = 10 * 60_000
const MB = (n: number) => Math.round((n / 1048576) * 10) / 10

type Timing = { ms: number; blockedMs: number; heapMB?: number }
const results: Record<string, unknown> = { tier }

async function startDriveServer(drive: FakeDrive): Promise<{ origin: string; close: () => Promise<void> }> {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,OPTIONS', 'access-control-expose-headers': 'Location' }
  const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors).end()
      return
    }
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k] = v
      const out = drive.handle({ method: req.method ?? 'GET', url: `https://www.googleapis.com${req.url}`, headers, body: chunks.length ? new Uint8Array(Buffer.concat(chunks)) : undefined })
      if (out === 'network-error') {
        req.socket.destroy()
        return
      }
      res.writeHead(out.status, { ...out.headers, ...cors }).end(typeof out.body === 'string' ? out.body : Buffer.from(out.body))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return { origin: `http://127.0.0.1:${port}`, close: () => new Promise((resolve) => server.close(() => resolve())) }
}

type Extra = { selector?: string; text?: string }

/**
 * Wait, inside the page and checked on every frame, until the page has its heading, no loading
 * placeholder and (when given) a piece of its real content. Resolves to the time since the page
 * load began, so the number does not include the test runner's own polling delays.
 */
async function ready(page: Page, extra: Extra = {}): Promise<number> {
  const handle = await page.waitForFunction(
    ({ selector, text }) => {
      if (!document.querySelector('h1')) return false
      if (document.querySelector('[role="status"][aria-label="Loading"]')) return false
      if (selector && !document.querySelector(selector)) return false
      if (text && !(document.body.textContent ?? '').includes(text)) return false
      return Math.max(1, Math.round(performance.now()))
    },
    extra,
    { polling: 'raf', timeout: LONG },
  )
  return (await handle.jsonValue()) as number
}

let heapOf: (() => Promise<number>) | undefined

async function pageStats(page: Page): Promise<{ blockedMs: number; heapMB?: number }> {
  const blockedMs = await page.evaluate(() => Math.round((window as unknown as { __long?: number }).__long ?? 0))
  return { blockedMs, heapMB: heapOf ? await heapOf() : undefined }
}

/** A full page load, as when the app is opened or refreshed on that page. */
async function load(page: Page, path: string, extra?: Extra): Promise<Timing> {
  await page.goto(path, { waitUntil: 'commit' })
  const ms = await ready(page, extra)
  return { ms, ...(await pageStats(page)) }
}

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const t = Date.now()
  const value = await fn()
  return { ms: Date.now() - t, value }
}

const num = (s: string | undefined) => (s === undefined ? NaN : Number(s.replace(/,/g, '')))

async function storeCount(page: Page, store: string): Promise<number> {
  return page.evaluate(
    (s) =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open('gymbook')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const req = db.transaction(s).objectStore(s).count()
          req.onsuccess = () => {
            db.close()
            resolve(req.result)
          }
          req.onerror = () => reject(req.error)
        }
      }),
    store,
  )
}

const SETTINGS: Extra = { text: 'Export backup (JSON)' }
const PAGES: { key: string; path: (g: Generated) => string; extra?: Extra }[] = [
  { key: 'dashboard', path: () => '/', extra: { text: 'members in total' } },
  { key: 'members', path: () => '/members', extra: { selector: 'input[placeholder="Search name or phone"]' } },
  { key: 'memberDetail', path: (g) => `/members/${g.probe.id}`, extra: { text: 'Days left' } },
  { key: 'attendance', path: () => '/attendance', extra: { selector: 'input[aria-label="From date"]' } },
  { key: 'payments', path: () => '/payments', extra: { selector: 'input[placeholder^="Who paid"]' } },
  { key: 'invoice', path: (g) => `/invoices/${g.debtor.invoiceId}`, extra: { text: 'Record payment' } },
  { key: 'followUps', path: () => '/follow-ups', extra: { text: 'Suggested' } },
  { key: 'reports', path: () => '/reports', extra: { selector: '[role="tab"]' } },
  { key: 'plans', path: () => '/plans', extra: { text: 'Half-yearly' } },
  { key: 'activity', path: () => '/activity', extra: { selector: 'input[placeholder="Search activity"]' } },
  { key: 'settings', path: () => '/settings', extra: SETTINGS },
]

test(`volume: ${tier.name} (${tier.members} members, ${tier.years} years)`, async ({ baseURL }, info) => {
  test.setTimeout(90 * 60_000)
  // A real profile folder rather than the usual throw-away test window: a throw-away window gets a
  // small storage allowance, which would make a large restore fail for a reason no real user meets.
  const context = await chromium.launchPersistentContext(info.outputPath('profile'), { baseURL, serviceWorkers: 'block', acceptDownloads: true, viewport: { width: 1280, height: 720 } })
  const page = context.pages()[0] ?? (await context.newPage())
  const drive = new FakeDrive()
  drive.addAccount('token-a', { id: 'acct-a', email: 'owner@example.com' })
  const server = await startDriveServer(drive)
  await context.addInitScript((origin) => {
    const w = window as unknown as { __long: number }
    w.__long = 0
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__long += e.duration
      }).observe({ type: 'longtask', buffered: true })
    } catch {
      /* long-task timing is not available */
    }
    const real = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      return url.startsWith('https://www.googleapis.com') ? real(url.replace('https://www.googleapis.com', origin), init) : real(input, init)
    }
  }, server.origin)
  await mockGoogle(page, drive)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('crash', () => errors.push('PAGE CRASHED'))

  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  heapOf = async () => {
    await cdp.send('HeapProfiler.collectGarbage')
    return Math.round(((await cdp.send('Performance.getMetrics')).metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0) / 1048576)
  }

  let refused = false
  try {
    await onboard(page, 'empty', 'Volume Test Gym')
    // Real 256px JPEGs of about the size the app stores for a member photo. Forty different ones, so
    // that compression cannot treat every member's photo as a repeat of the last.
    const photos = await page.evaluate(() => {
      const out: string[] = []
      for (let n = 0; n < 40; n++) {
        const c = document.createElement('canvas')
        c.width = c.height = 256
        const g = c.getContext('2d')!
        const grad = g.createLinearGradient(0, 0, 256, 256)
        grad.addColorStop(0, `hsl(${n * 9}, 45%, 62%)`)
        grad.addColorStop(1, `hsl(${n * 9 + 60}, 40%, 30%)`)
        g.fillStyle = grad
        g.fillRect(0, 0, 256, 256)
        for (let k = 0; k < 900; k++) {
          g.fillStyle = `hsla(${Math.random() * 360}, 50%, ${30 + Math.random() * 50}%, 0.5)`
          g.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 22, 2 + Math.random() * 22)
        }
        out.push(c.toDataURL('image/jpeg', 0.8))
      }
      return out
    })
    results.photoKB = Math.round((photos.reduce((s, p) => s + p.length, 0) / photos.length) * 0.75 / 1024)

    const gen = (await timed(() => generate(tier, photos, info.outputPath('volume-backup.json')))).value
    results.file = { MB: MB(gen.bytes), counts: gen.counts }
    console.log(`[volume] generated ${MB(gen.bytes)} MB`, gen.counts)

    // ---- 1. Import the file through Settings, the way a person would ----
    await test.step('import', async () => {
      await load(page, '/settings', SETTINGS)
      const dialog = page.getByRole('dialog')
      const validate = await timed(async () => {
        await page.locator('input[type=file][accept*=json]').setInputFiles(gen.path)
        await expect(dialog.getByText(/Replace all data with this backup\?|can’t be imported/)).toBeVisible({ timeout: LONG })
      })
      if (await dialog.getByText('can’t be imported').isVisible()) {
        // The app refused the file. That is only acceptable for a file beyond what a browser can read at once.
        const reason = (await dialog.innerText()).replace(/\s+/g, ' ').trim()
        results.import = { refused: reason, readAndCheckMs: validate.ms }
        console.log('[volume] import refused:', reason)
        expect(gen.bytes, 'only a file beyond the browser limit may be refused').toBeGreaterThan(500 * 1048576)
        expect(reason).toMatch(/too large|larger than/i)
        expect(await storeCount(page, 'members'), 'nothing was changed').toBe(0)
        refused = true
        return
      }
      const write = await timed(async () => {
        await dialog.getByRole('button', { name: 'Replace my data' }).click()
        await expect(page.getByText('Backup restored').first()).toBeVisible({ timeout: 30 * 60_000 })
      })
      results.import = { readAndCheckMs: validate.ms, writeMs: write.ms }
      console.log('[volume] import', results.import)
      for (const s of ['members', 'memberships', 'invoices', 'payments', 'attendance', 'followups']) expect(await storeCount(page, s), `${s} rows after import`).toBe(gen.counts[s])
      // The import adds one "Restored backup" line of its own.
      expect(await storeCount(page, 'activity')).toBe(gen.counts.activity + 1)
      results.storageAfterImport = await page.evaluate(async () => {
        const e = await navigator.storage.estimate()
        return { usedMB: Math.round((e.usage ?? 0) / 1048576), quotaMB: Math.round((e.quota ?? 0) / 1048576) }
      })
      console.log('[volume] storage', results.storageAfterImport)
    })

    if (refused) return

    // ---- How long the browser's own database takes to hand each store back (no app code involved) ----
    await test.step('raw read times', async () => {
      await load(page, '/plans', { text: 'Half-yearly' })
      results.rawReadMs = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const open = indexedDB.open('gymbook')
          open.onsuccess = () => resolve(open.result)
          open.onerror = () => reject(open.error)
        })
        const out: Record<string, number> = {}
        for (const s of ['members', 'memberships', 'invoices', 'payments', 'attendance', 'activity']) {
          const t = performance.now()
          await new Promise((resolve, reject) => {
            const req = db.transaction(s).objectStore(s).getAll()
            req.onsuccess = () => resolve(req.result.length)
            req.onerror = () => reject(req.error)
          })
          out[s] = Math.round(performance.now() - t)
        }
        db.close()
        return out
      })
      console.log('[volume] raw read ms', results.rawReadMs)
    })

    // ---- 2. The numbers on the dashboard must equal what the generator knows to be true ----
    await test.step('dashboard is correct', async () => {
      await load(page, '/', { text: 'members in total' })
      const text = await page.locator('main').innerText()
      const got = {
        activeMembers: num(/Active members\s+([\d,]+)/.exec(text)?.[1]),
        liveMembers: num(/([\d,]+) members? in total/.exec(text)?.[1]),
        visitsToday: num(/Attendance today\s+([\d,]+)/.exec(text)?.[1]),
        checkedInNow: num(/([\d,]+) in the gym now/.exec(text)?.[1]),
        membersWithBalance: num(/([\d,]+) members? owes? money/.exec(text)?.[1]),
      }
      results.dashboard = { got, expected: gen.expect }
      expect(got).toEqual({ activeMembers: gen.expect.activeMembers, liveMembers: gen.expect.liveMembers, visitsToday: gen.expect.visitsToday, checkedInNow: gen.expect.checkedInNow, membersWithBalance: gen.expect.membersWithBalance })
    })

    // ---- 3. How long each page takes to open, on this computer and on a slow phone ----
    for (const rate of [1, 4]) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate })
      const pages: Record<string, Timing> = {}
      for (const p of PAGES) {
        pages[p.key] = await load(page, p.path(gen), p.extra)
        console.log(`[volume] cpu×${rate} ${p.key}`, pages[p.key])
      }
      results[rate === 1 ? 'pages' : 'pagesSlowPhone'] = pages
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })

    // ---- 4. Everyday actions ----
    // Each wait is checked inside the page on every frame, so the time is what the person would see.
    const hasText = (text: string) => page.waitForFunction((t) => (document.body.textContent ?? '').includes(t), text, { polling: 'raf', timeout: LONG })
    /** Click through the DOM, so the test runner's own "is it steady yet" waits are not counted. */
    const press = (name: string, scope = 'body') =>
      page.evaluate(
        ([n, sc]) => {
          const hit = [...document.querySelectorAll<HTMLElement>(`${sc} button, ${sc} [role="tab"]`)].filter((x) => (x.textContent ?? '').trim() === n && !(x as HTMLButtonElement).disabled).pop()
          if (!hit) throw new Error(`No enabled button "${n}"`)
          hit.click()
        },
        [name, scope],
      )
    const actions: Record<string, number> = {}
    await test.step('search members', async () => {
      await load(page, '/members', { selector: 'input[placeholder="Search name or phone"]' })
      const box = page.getByPlaceholder('Search name or phone')
      const clear = async () => {
        await box.fill('zzzz-no-such-member')
        await hasText('No members match')
      }
      await clear()
      actions.searchByName = (await timed(async () => {
        await box.fill(gen.probe.name)
        await hasText(gen.probe.name)
      })).ms
      await clear()
      actions.searchByPhone = (await timed(async () => {
        await box.fill(gen.probe.phone)
        await hasText(gen.probe.name)
      })).ms
      actions.openMemberFromList = (await timed(async () => {
        await page.getByText(gen.probe.name).first().click()
        await page.waitForFunction((id) => location.pathname.endsWith(id) && (document.body.textContent ?? '').includes('Days left'), gen.probe.id, { polling: 'raf', timeout: LONG })
      })).ms
    })

    const newName = 'Vol New Joiner 99999'
    await test.step('add a member with a plan', async () => {
      await load(page, '/members/new')
      await page.getByLabel('Full name').fill(newName)
      await page.getByLabel(/^Phone/).fill('98200 99999')
      await page.getByLabel('Plan', { exact: true }).selectOption({ index: 1 })
      await page.getByLabel('Received now').fill('500')
      actions.addMemberWithPlan = (await timed(async () => {
        await press('Add member and create invoice')
        await page.waitForFunction(() => location.pathname.startsWith('/members/mem_') && (document.body.textContent ?? '').includes('Days left'), undefined, { polling: 'raf', timeout: LONG })
      })).ms
      expect(await storeCount(page, 'members')).toBe(gen.counts.members + 1)
    })

    await test.step('check in', async () => {
      await load(page, '/attendance', { selector: 'input[aria-label="From date"]' })
      const box = page.getByRole('combobox')
      actions.checkInSearch = (await timed(async () => {
        await box.fill(newName)
        await page.waitForFunction((n) => [...document.querySelectorAll('[role="option"]')].some((o) => (o.textContent ?? '').includes(n)), newName, { polling: 'raf', timeout: LONG })
      })).ms
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await expect(page.getByRole('button', { name: 'Clear selected member' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Check in' })).toBeEnabled()
      actions.checkIn = (await timed(async () => {
        await press('Check in')
        await hasText(`${newName} checked in`)
      })).ms
      expect(await storeCount(page, 'attendance')).toBe(gen.counts.attendance + 1)
    })

    await test.step('record a payment', async () => {
      await load(page, `/invoices/${gen.debtor.invoiceId}`, { text: 'Record payment' })
      await page.getByRole('button', { name: 'Record payment' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel('Amount received').fill('100')
      actions.recordPayment = (await timed(async () => {
        await press('Record payment', '[role="dialog"]')
        await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), undefined, { polling: 'raf', timeout: LONG })
      })).ms
      // one payment from the new member's plan, one recorded here
      expect(await storeCount(page, 'payments')).toBe(gen.counts.payments + 2)
    })

    await test.step('reports for the whole year', async () => {
      await load(page, '/reports', { selector: '[role="tab"]' })
      await expect(page.getByRole('tab', { name: 'This year' })).toBeVisible()
      actions.reportThisYear = (await timed(async () => {
        await press('This year')
        await page.waitForFunction(() => [...document.querySelectorAll('[role="tab"]')].some((t) => t.textContent === 'This year' && t.getAttribute('aria-selected') === 'true'), undefined, { polling: 'raf', timeout: LONG })
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))))
      })).ms
    })
    await test.step('CSV exports for the whole year', async () => {
      // Still on Reports with "This year" selected.
      for (const what of ['Payments', 'Invoices', 'Attendance', 'Members']) {
        const t = Date.now()
        const [download] = await Promise.all([page.waitForEvent('download', { timeout: LONG }), page.getByRole('button', { name: what, exact: true }).click()])
        const path = info.outputPath(`export-${what}.csv`)
        await download.saveAs(path)
        actions[`csv${what}`] = Date.now() - t
        expect(statSync(path).size, `${what} CSV is not empty`).toBeGreaterThan(100)
      }
    })
    results.actions = actions
    console.log('[volume] actions', actions)

    // ---- 5. Backup file export ----
    await test.step('export', async () => {
      await load(page, '/settings', SETTINGS)
      const t = Date.now()
      const [download] = await Promise.all([page.waitForEvent('download', { timeout: LONG }), page.getByRole('button', { name: 'Export backup (JSON)' }).click()])
      const path = info.outputPath('exported.json')
      await download.saveAs(path)
      const bytes = statSync(path).size
      results.export = { ms: Date.now() - t, MB: MB(bytes) }
      console.log('[volume] export', results.export)
      if (bytes < 400 * 1048576) {
        const data = (JSON.parse(readFileSync(path, 'utf8')) as { data: Record<string, unknown[]> }).data
        expect(data.members.length).toBe(gen.counts.members + 1)
        expect(data.attendance.length).toBe(gen.counts.attendance + 1)
        expect(data.payments.length).toBe(gen.counts.payments + 2)
      }
    })

    // ---- 6. Google Drive backup and restore (stand-in for Google) ----
    await test.step('drive backup and restore', async () => {
      await load(page, '/settings', { text: 'Sign in with Google' })
      await setGoogle(page, { token: 'token-a' })
      const section = page.locator('#drive')
      await section.getByRole('button', { name: 'Sign in with Google' }).click()
      await expect(section.getByText('owner@example.com')).toBeVisible({ timeout: LONG })
      const backup = await timed(async () => {
        await section.getByRole('button', { name: 'Back up now' }).click()
        await expect(section.getByText(/Backup saved to Google Drive|could not|failed|too large|not enough/i).first()).toBeVisible({ timeout: 30 * 60_000 })
      })
      await expect(section.getByText('Backup saved to Google Drive')).toBeVisible()
      const file = drive.files('acct-a')[0]
      const uploads = drive.log.filter((l) => l.path.startsWith('/upload/')).map((l) => l.method)
      const again = await timed(async () => {
        await section.getByRole('button', { name: 'Back up now' }).click()
        await expect(section.getByText('Already up to date')).toBeVisible({ timeout: LONG })
      })
      const restore = await timed(async () => {
        await section.getByRole('button', { name: 'Restore…' }).click()
        const dialog = page.getByRole('dialog')
        await expect(dialog.getByText('Replace all data on this device with this backup?')).toBeVisible({ timeout: LONG })
        const [safety] = await Promise.all([page.waitForEvent('download', { timeout: LONG }), dialog.getByRole('button', { name: 'Replace my data' }).click()])
        await safety.saveAs(info.outputPath('safety-copy.json'))
        await expect(section.getByText(/Restored from Google Drive|Restored, but|could not|failed/i).first()).toBeVisible({ timeout: 30 * 60_000 })
      })
      await expect(section.getByText('Restored from Google Drive')).toBeVisible()
      await expect(section.getByText('Every record was read back and matches the backup.', { exact: false })).toBeVisible()
      results.drive = { backupMs: backup.ms, fileMB: MB(file.content.length), uploadRequests: uploads, unchangedCheckMs: again.ms, restoreMs: restore.ms, safetyCopyMB: MB(statSync(info.outputPath('safety-copy.json')).size) }
      console.log('[volume] drive', results.drive)
      expect(await storeCount(page, 'members')).toBe(gen.counts.members + 1)
      expect(await storeCount(page, 'attendance')).toBe(gen.counts.attendance + 1)
    })

    // ---- 7. Opening the app again once it is tied to a Google account ----
    await test.step('start-up with Drive backup switched on', async () => {
      const start = await load(page, '/', { text: 'members in total' })
      await page.waitForTimeout(6000)
      results.startupWithDrive = { dashboardMs: start.ms, frozenInFirstSecondsMs: (await pageStats(page)).blockedMs }
      console.log('[volume] start-up with Drive', results.startupWithDrive)
    })

    results.storage = await page.evaluate(async () => {
      const e = await navigator.storage.estimate()
      return { usedMB: Math.round((e.usage ?? 0) / 1048576), quotaMB: Math.round((e.quota ?? 0) / 1048576) }
    })
  } finally {
    results.pageErrors = errors
    const out = process.env.VOLUME_OUT ?? info.outputPath('volume-result.json')
    writeFileSync(out, JSON.stringify(results, null, 2))
    console.log(`[volume] results written to ${out}`)
    await context.close()
    await server.close()
  }
  expect(errors, 'no uncaught errors in the page').toEqual([])
})
