import { test, expect, type Page, type Locator } from '@playwright/test'
import { onboard, createPlan, addMember, sellMembership, readStore, inr } from '../helpers'
import { addDays, todayInTz, formatDate, instantToDateInTz } from '../../src/domain/dates'

const TZ = 'Asia/Kolkata'
const today = () => todayInTz(TZ)
const dateOf = (iso: string) => instantToDateInTz(iso, TZ)

// ---------- console / pageerror guard (requirement 6) ----------
const consoleErrors: string[] = []
test.beforeEach(async ({ page }, testInfo) => {
  testInfo.setTimeout(90_000)
  consoleErrors.length = 0
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`console.error: ${msg.text()}`)
  })
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`))
})
test.afterEach(async () => {
  expect(consoleErrors, 'no console errors or page errors').toEqual([])
})

// ---------- helpers ----------
async function putStore(page: Page, store: string, rows: unknown[]) {
  await page.evaluate(
    ({ s, r }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('gymbook')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction(s, 'readwrite')
          const os = tx.objectStore(s)
          for (const row of r) os.put(row)
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
    { s: store, r: rows },
  )
}

const stamp = (prefix: string, extra: object, i: number) => {
  const now = new Date().toISOString()
  return { id: `${prefix}_test${i}_${Math.random().toString(36).slice(2, 8)}`, createdAt: now, updatedAt: now, rev: 1, ...extra }
}

function statCard(page: Page, label: string): Locator {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return page.getByRole('main').locator('p', { hasText: new RegExp(`^${esc}$`) }).first().locator('xpath=ancestor::*[contains(@class,"rounded-2xl")][1]')
}

async function pickMember(page: Page, scope: Page | Locator, name: string) {
  const clear = scope.getByRole('button', { name: 'Clear selected member' })
  if (await clear.count()) await clear.click()
  const box = scope.locator('input[role=combobox]')
  await box.fill(name)
  await scope.getByRole('option', { name: new RegExp(name) }).click()
}

/** Minimal RFC4180 parser (handles quotes, embedded commas/newlines, CRLF and BOM). */
function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else q = false
      } else cell += c
    } else if (c === '"') q = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\r') {
      /* skip */
    } else if (c === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

async function downloadCsv(page: Page, button: string): Promise<{ name: string; rows: string[][]; text: string }> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: button, exact: true }).click()])
  const text = await (await download.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString('utf8'))
  return { name: download.suggestedFilename(), rows: parseCsv(text), text }
}

/** Sell a plan to the member currently open, starting on a custom date. */
async function sellWithStart(page: Page, startDate: string) {
  await page.getByRole('button', { name: /Sell membership|Renew/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: /Pick a date/ }).click()
  await dialog.getByLabel(/^Start date/).fill(startDate)
  await dialog.getByRole('button', { name: /Sell and create invoice|Renew and create invoice/ }).click()
  await expect(page).toHaveURL(/\/invoices\/inv_/)
}

type Att = { id: string; memberId: string; checkInAt: string; checkOutAt: string | null; overrideReason?: string; rev: number }

// =====================================================================
// 1. ATTENDANCE
// =====================================================================
test.describe('attendance', () => {
  test('check-in by keyboard and mouse, archived not pickable, upcoming → override, counts match store', async ({ page }) => {
    await onboard(page, 'empty')
    await createPlan(page, 'Monthly', 1, 'months', '1500')
    await addMember(page, 'Kiran Das', '98200 00003')
    await sellMembership(page, { receivedNow: '1500' })
    await addMember(page, 'Mona Roy', '98200 00009')
    await sellMembership(page, { receivedNow: '1500' })
    const archUrl = await addMember(page, 'Archie Old', '98200 00010')
    await page.goto(archUrl)
    await page.getByRole('button', { name: 'Archive' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click()
    await expect(page.getByText('Archived', { exact: true }).first()).toBeVisible()
    await addMember(page, 'Futura Soon', '98200 00011')
    await sellWithStart(page, addDays(today(), 1))

    // ?action=checkin focuses the search and strips the param
    await page.goto('/attendance?action=checkin')
    await expect(page.getByRole('combobox')).toBeFocused()
    await expect(page).toHaveURL(/\/attendance$/)

    // keyboard: type, ArrowDown, Enter
    const box = page.getByRole('combobox')
    await box.fill('Kir')
    await expect(page.getByRole('option', { name: /Kiran Das/ })).toBeVisible()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Clear selected member' })).toBeVisible()
    await expect(page.getByText('Active', { exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Check in' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Kiran Das checked in' })).toBeVisible()
    // selection is cleared after check-in
    await expect(page.getByRole('combobox')).toBeVisible()

    // mouse
    await pickMember(page, page, 'Mona')
    await page.getByRole('button', { name: 'Check in' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Mona Roy checked in' })).toBeVisible()

    // archived member not pickable
    await page.getByRole('combobox').fill('Archie')
    await expect(page.getByText('No members match.')).toBeVisible()
    await expect(page.getByRole('option')).toHaveCount(0)

    // upcoming membership → override dialog, empty/whitespace reason keeps button disabled
    await pickMember(page, page, 'Futura')
    await expect(page.getByText('Starts later', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(/starts/)).toBeVisible()
    await expect(page.getByText('No active membership today')).toBeVisible()
    await page.getByRole('button', { name: 'Check in' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'No active membership' })).toBeVisible()
    await expect(dialog).toContainText('Futura Soon has no active membership today')
    const allow = dialog.getByRole('button', { name: 'Allow entry anyway' })
    await expect(allow).toBeDisabled()
    await dialog.getByLabel(/^Reason for allowing entry/).fill('   ')
    await expect(allow).toBeDisabled()
    await dialog.getByLabel(/^Reason for allowing entry/).fill('  Starts tomorrow, owner OK  ')
    await expect(allow).toBeEnabled()
    await allow.click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('status').filter({ hasText: 'Futura Soon checked in' })).toBeVisible()

    // store vs UI counts
    let att = await readStore<Att>(page, 'attendance')
    expect(att).toHaveLength(3)
    const futura = att.find((a) => a.overrideReason)
    expect(futura?.overrideReason).toBe('Starts tomorrow, owner OK')
    expect(att.every((a) => a.checkOutAt === null)).toBe(true)
    const inside = att.filter((a) => a.checkOutAt === null).length
    const visitsToday = att.filter((a) => dateOf(a.checkInAt) === today()).length
    await expect(statCard(page, 'In the gym now')).toContainText(String(inside))
    await expect(statCard(page, 'Visits today')).toContainText(String(visitsToday))
    await expect(page.getByText('3 visits on')).toBeVisible()
    // history shows the override reason
    await expect(page.getByText('Override: Starts tomorrow, owner OK')).toBeVisible()

    // check out from "Currently inside" (newest first → Futura)
    const insideList = page.getByRole('heading', { name: 'Currently inside' }).locator('xpath=ancestor::*[contains(@class,"rounded-2xl")][1]')
    await expect(insideList.getByRole('listitem')).toHaveCount(3)
    await insideList.getByRole('listitem').filter({ hasText: 'Mona Roy' }).getByRole('button', { name: 'Out' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Mona Roy checked out' })).toBeVisible()
    await expect(insideList.getByRole('listitem')).toHaveCount(2)
    await expect(statCard(page, 'In the gym now')).toContainText('2')
    await expect(statCard(page, 'Visits today')).toContainText('3')
    att = await readStore<Att>(page, 'attendance')
    const mona = (await readStore<{ id: string; name: string }>(page, 'members')).find((m) => m.name === 'Mona Roy')!
    expect(att.find((a) => a.memberId === mona.id)?.checkOutAt).not.toBeNull()

    // check out from member detail
    const kiran = (await readStore<{ id: string; name: string }>(page, 'members')).find((m) => m.name === 'Kiran Das')!
    await page.goto(`/members/${kiran.id}`)
    await page.getByRole('button', { name: 'Check out' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Kiran Das checked out' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check in' })).toBeVisible()
    att = await readStore<Att>(page, 'attendance')
    expect(att.find((a) => a.memberId === kiran.id)?.checkOutAt).not.toBeNull()
    expect(att.filter((a) => a.checkOutAt === null)).toHaveLength(1)

    // check in again from member detail works after checkout (no duplicate open visit)
    await page.getByRole('button', { name: 'Check in' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Kiran Das checked in' })).toBeVisible()
    att = await readStore<Att>(page, 'attendance')
    expect(att.filter((a) => a.memberId === kiran.id)).toHaveLength(2)
    await page.goto('/attendance')
    await expect(statCard(page, 'Visits today')).toContainText('4')
    await expect(statCard(page, 'In the gym now')).toContainText('2')
  })

  test('history range: Today / 7 days, custom range, from > to, daily total chips', async ({ page }) => {
    await onboard(page, 'empty')
    await createPlan(page, 'Monthly', 1, 'months', '1500')
    await addMember(page, 'Hist Member', '98200 00020')
    await sellMembership(page, { receivedNow: '1500' })
    const member = (await readStore<{ id: string }>(page, 'members'))[0]
    const t = today()
    const at = (date: string, h: number) => new Date(`${date}T${String(h).padStart(2, '0')}:00:00+05:30`).toISOString()
    const rows = [
      stamp('att', { memberId: member.id, checkInAt: at(t, 7), checkOutAt: at(t, 8), source: 'manual' }, 1),
      stamp('att', { memberId: member.id, checkInAt: at(addDays(t, -1), 7), checkOutAt: at(addDays(t, -1), 8), source: 'manual' }, 2),
      stamp('att', { memberId: member.id, checkInAt: at(addDays(t, -1), 18), checkOutAt: at(addDays(t, -1), 19), source: 'manual' }, 3),
      stamp('att', { memberId: member.id, checkInAt: at(addDays(t, -6), 7), checkOutAt: at(addDays(t, -6), 8), source: 'manual' }, 4),
      stamp('att', { memberId: member.id, checkInAt: at(addDays(t, -7), 7), checkOutAt: at(addDays(t, -7), 8), source: 'manual' }, 5),
      stamp('att', { memberId: member.id, checkInAt: at(addDays(t, -40), 7), checkOutAt: at(addDays(t, -40), 8), source: 'manual' }, 6),
    ]
    await putStore(page, 'attendance', rows)
    await page.goto('/attendance')

    // default = today
    await expect(page.getByText(`1 visit on ${formatDate(t)}`)).toBeVisible()
    await expect(statCard(page, 'Visits today')).toContainText('1')
    await expect(page.locator('button', { hasText: '·' })).toHaveCount(0) // no chips for a single day

    // 7 days
    await page.getByRole('button', { name: '7 days' }).click()
    await expect(page).toHaveURL(new RegExp(`from=${addDays(t, -6)}&to=${t}`))
    await expect(page.getByText(`4 visits from ${formatDate(addDays(t, -6))} to ${formatDate(t)}`)).toBeVisible()
    const chips = page.getByRole('button').filter({ hasText: /\d{4} · \d/ })
    await expect(chips).toHaveCount(3)
    await expect(chips.nth(0)).toHaveText(`${formatDate(t)} · 1`)
    await expect(chips.nth(1)).toHaveText(`${formatDate(addDays(t, -1))} · 2`)
    await expect(chips.nth(2)).toHaveText(`${formatDate(addDays(t, -6))} · 1`)
    // chip click narrows to that day
    await chips.nth(1).click()
    await expect(page).toHaveURL(new RegExp(`from=${addDays(t, -1)}&to=${addDays(t, -1)}`))
    await expect(page.getByText(`2 visits on ${formatDate(addDays(t, -1))}`)).toBeVisible()
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(3) // header + 2

    // Today
    await page.getByRole('button', { name: 'Today', exact: true }).click()
    await expect(page.getByText(`1 visit on ${formatDate(t)}`)).toBeVisible()

    // custom range covering everything
    await page.getByLabel('From date').fill(addDays(t, -45))
    await expect(page.getByText(`6 visits from ${formatDate(addDays(t, -45))} to ${formatDate(t)}`)).toBeVisible()
    await page.getByLabel('To date').fill(addDays(t, -7))
    await expect(page.getByText(`2 visits from ${formatDate(addDays(t, -45))} to ${formatDate(addDays(t, -7))}`)).toBeVisible()

    // from > to: moving From past To should drag To along
    await page.getByLabel('From date').fill(addDays(t, -1))
    await expect(page).toHaveURL(new RegExp(`from=${addDays(t, -1)}&to=${addDays(t, -1)}`))
    await expect(page.getByText(`2 visits on ${formatDate(addDays(t, -1))}`)).toBeVisible()

    // to < from via the To input: the UI should not end up with an inverted range
    await page.getByLabel('To date').fill(addDays(t, -6))
    const url = new URL(page.url())
    const from = url.searchParams.get('from')!
    const to = url.searchParams.get('to')!
    expect(to >= from, `inverted range accepted via To input: from=${from} to=${to}`).toBe(true)
    // An earlier "To" collapses the range onto the From day instead of inverting it.
    await expect(page.getByText(new RegExp(`^\\d+ visits? on ${formatDate(addDays(t, -1))}$`))).toBeVisible()

    // invalid URL params fall back to today
    await page.goto('/attendance?from=2026-13-45&to=garbage')
    await expect(page.getByText(`1 visit on ${formatDate(t)}`)).toBeVisible()
    // to < from in the URL
    await page.goto(`/attendance?from=${t}&to=${addDays(t, -3)}`)
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
    await expect(page.getByText(/^\d+ visits? (on|from)/)).toBeVisible()
    await expect.soft(page.getByText(/^0 visits from/), 'inverted range from URL rendered').toHaveCount(0, { timeout: 1500 })
  })
})

// =====================================================================
// 2. TRAINERS
// =====================================================================
test.describe('trainers', () => {
  test('validation, edit, archive/restore, member form visibility, assigned members', async ({ page }) => {
    await onboard(page, 'empty')
    await page.goto('/trainers')
    await expect(page.getByText('No trainers yet')).toBeVisible()
    await page.getByRole('button', { name: 'Add trainer' }).first().click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(/^Full name/).fill('A')
    await dialog.getByLabel(/^Phone/).fill('123')
    await dialog.getByRole('button', { name: 'Add trainer' }).click()
    await expect(dialog.getByText('Name must be at least 2 characters')).toBeVisible()
    await expect(dialog.getByText('Enter a valid phone number')).toBeVisible()
    await expect(dialog.getByText(/Enter a specialty/)).toBeVisible()
    expect(await readStore(page, 'trainers')).toHaveLength(0)
    // phone with letters
    await dialog.getByLabel(/^Phone/).fill('98765abc01')
    await dialog.getByRole('button', { name: 'Add trainer' }).click()
    await expect(dialog.getByText('Enter a valid phone number')).toBeVisible()
    // too few digits
    await dialog.getByLabel(/^Phone/).fill('98765 0')
    await dialog.getByRole('button', { name: 'Add trainer' }).click()
    await expect(dialog.getByText(/valid phone|8 to 15 digits/)).toBeVisible()
    // bad email
    await dialog.getByLabel(/^Email/).fill('not-an-email')
    await dialog.getByRole('button', { name: 'Add trainer' }).click()
    await expect(dialog.getByText('Enter a valid email address')).toBeVisible()

    await dialog.getByLabel(/^Full name/).fill('Rohit Verma')
    await dialog.getByLabel(/^Phone/).fill('98765 00001')
    await dialog.getByLabel(/^Email/).fill('rohit@example.com')
    await dialog.getByLabel(/^Specialty/).fill('Strength')
    await dialog.getByLabel(/^Notes/).fill('Mornings only')
    await dialog.getByRole('button', { name: 'Add trainer' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('status').filter({ hasText: 'Added Rohit Verma' })).toBeVisible()
    let trainers = await readStore<{ id: string; name: string; status: string; rev: number; specialty: string; email?: string; notes?: string }>(page, 'trainers')
    expect(trainers).toHaveLength(1)
    expect(trainers[0]).toMatchObject({ name: 'Rohit Verma', status: 'active', specialty: 'Strength', email: 'rohit@example.com', notes: 'Mornings only', rev: 1 })
    const trainerId = trainers[0].id
    await expect(page.getByText('0 assigned members · 0 schedule slots')).toBeVisible()
    await expect(page.getByRole('link', { name: 'tel:', exact: false })).toHaveCount(0)
    await expect(page.locator('a[href="tel:9876500001"]')).toBeVisible()
    await expect(page.locator('a[href="mailto:rohit@example.com"]')).toBeVisible()

    // assign a member, then verify assigned list
    await page.goto('/members/new')
    await page.getByLabel('Full name').fill('Assigned Person')
    await page.getByLabel(/^Phone/).fill('98200 00030')
    await page.getByLabel('Trainer').selectOption({ label: 'Rohit Verma' })
    await page.getByRole('button', { name: 'Add member' }).click()
    await expect(page).toHaveURL(/\/members\/mem_/)
    const memberUrl = page.url()
    const members = await readStore<{ id: string; trainerId?: string }>(page, 'members')
    expect(members[0].trainerId).toBe(trainerId)

    await page.goto(`/trainers/${trainerId}`)
    await expect(page.getByRole('heading', { name: 'Rohit Verma' })).toBeVisible()
    await expect(page.getByText('1 active member')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Assigned Person' })).toBeVisible()
    await page.goto('/trainers')
    await expect(page.getByText('1 assigned member · 0 schedule slots')).toBeVisible()

    // edit
    await page.goto(`/trainers/${trainerId}`)
    await page.getByRole('button', { name: 'Edit' }).click()
    const edit = page.getByRole('dialog')
    await expect(edit.getByRole('heading', { name: 'Edit Rohit Verma' })).toBeVisible()
    await expect(edit.getByLabel(/^Specialty/)).toHaveValue('Strength')
    await edit.getByLabel(/^Specialty/).fill('Strength & conditioning')
    await edit.getByLabel(/^Notes/).fill('')
    await edit.getByRole('button', { name: 'Save changes' }).click()
    await expect(edit).toBeHidden()
    await expect(page.getByText('Strength & conditioning')).toBeVisible()
    trainers = await readStore(page, 'trainers')
    expect(trainers[0]).toMatchObject({ specialty: 'Strength & conditioning', rev: 2 })
    expect(trainers[0].notes).toBeUndefined()
    await expect(page.getByText('—', { exact: true })).toBeVisible()

    // dirty-close guard on the dialog
    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByRole('dialog').getByLabel(/^Notes/).fill('typed')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Discard unsaved changes?' })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Discard' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // archive
    await page.getByRole('button', { name: 'Archive' }).click()
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Archive Rohit Verma?' })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Archive' }).click()
    await expect(page.getByText('Archived', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: "can’t be chosen for new assignments" })).toBeVisible()
    trainers = await readStore(page, 'trainers')
    expect(trainers[0].status).toBe('archived')
    // still lists assigned member
    await expect(page.getByRole('link', { name: 'Assigned Person' })).toBeVisible()

    // trainers list hides archived by default, toggle shows it
    await page.goto('/trainers')
    await expect(page.getByText('No trainers yet')).toBeVisible()
    await page.getByRole('button', { name: /Show archived \(1\)/ }).click()
    await expect(page.getByRole('link', { name: /Rohit Verma/ })).toBeVisible()
    await expect(page.getByText('Archived', { exact: true })).toBeVisible()

    // archived trainer not selectable for a new member, but kept on the existing member
    await page.goto('/members/new')
    await expect(page.getByLabel('Trainer').locator('option')).toHaveText(['No trainer'])
    await page.goto(memberUrl + '/edit')
    const sel = page.getByLabel('Trainer')
    await expect(sel).toHaveValue(trainerId)
    await expect(sel.locator('option', { hasText: 'Rohit Verma (archived)' })).toHaveCount(1)
    await page.getByLabel('Notes', { exact: true }).fill('touch')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page).toHaveURL(memberUrl)
    expect((await readStore<{ trainerId?: string }>(page, 'members'))[0].trainerId).toBe(trainerId)
    await expect(page.getByText('Rohit Verma').first()).toBeVisible()

    // restore
    await page.goto(`/trainers/${trainerId}`)
    await page.getByRole('button', { name: 'Restore' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Restore' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Trainer restored' })).toBeVisible()
    trainers = await readStore(page, 'trainers')
    expect(trainers[0].status).toBe('active')
    await page.goto('/members/new')
    await expect(page.getByLabel('Trainer').locator('option')).toHaveText(['No trainer', 'Rohit Verma'])
  })

  test('schedules: overlap rules, touching intervals, end before start, edit into overlap, delete, live warning', async ({ page }) => {
    await onboard(page, 'empty')
    await page.goto('/trainers')
    await page.getByRole('button', { name: 'Add trainer' }).first().click()
    let dialog = page.getByRole('dialog')
    await dialog.getByLabel(/^Full name/).fill('Priya Nair')
    await dialog.getByLabel(/^Phone/).fill('98765 00002')
    await dialog.getByLabel(/^Specialty/).fill('Yoga')
    await dialog.getByRole('button', { name: 'Add trainer' }).click()
    await expect(dialog).toBeHidden()
    const trainerId = (await readStore<{ id: string }>(page, 'trainers'))[0].id
    await page.goto(`/trainers/${trainerId}`)
    await expect(page.getByText('No schedule yet')).toBeVisible()

    const addSlot = async (day: string, from: string, to: string, label: string) => {
      await page.getByRole('button', { name: 'Add slot' }).click()
      const d = page.getByRole('dialog')
      await d.getByLabel(/^Day/).selectOption(day)
      await d.getByLabel(/^From/).fill(from)
      await d.getByLabel(/^To/).fill(to)
      await d.getByLabel(/^Label/).fill(label)
      return d
    }

    // label required
    let d = await addSlot('Monday', '10:00', '11:00', '')
    await d.getByRole('button', { name: 'Add slot' }).click()
    await expect(d.getByText(/Enter a label/)).toBeVisible()
    await d.getByLabel(/^Label/).fill('Morning')
    await d.getByRole('button', { name: 'Add slot' }).click()
    await expect(d).toBeHidden()
    await expect(page.getByRole('status').filter({ hasText: 'Slot added' })).toBeVisible()
    await expect(page.getByText('10:00 am – 11:00 am')).toBeVisible()

    // overlap on same day: live warning + save rejected
    d = await addSlot('Monday', '10:30', '11:30', 'Clash')
    await expect(d.getByRole('alert')).toContainText('Overlaps “Morning” (10:00 am – 11:00 am)')
    await d.getByRole('button', { name: 'Add slot' }).click()
    await expect(d).toBeVisible()
    await expect(d.getByText(/Overlaps "Morning" on Monday/)).toBeVisible()
    expect(await readStore(page, 'schedules')).toHaveLength(1)
    // fully containing interval is also an overlap
    await d.getByLabel(/^From/).fill('09:00')
    await d.getByLabel(/^To/).fill('12:00')
    await expect(d.getByRole('alert').filter({ hasText: 'Overlaps “Morning”' })).toBeVisible()
    // touching interval (11:00–12:00) is allowed: warning disappears, saves
    await d.getByLabel(/^From/).fill('11:00')
    await d.getByLabel(/^To/).fill('12:00')
    await expect(d.getByRole('alert').filter({ hasText: 'Overlaps “' })).toHaveCount(0)
    // the server-side rejection message should not linger once the times no longer clash
    await expect.soft(d.getByRole('alert').filter({ hasText: 'Overlaps "Morning" on Monday' }), 'stale overlap form error stays after fixing the times').toHaveCount(0, { timeout: 1500 })
    await d.getByLabel(/^Label/).fill('Late morning')
    await d.getByRole('button', { name: 'Add slot' }).click()
    await expect(d).toBeHidden()
    expect(await readStore(page, 'schedules')).toHaveLength(2)

    // end before start / equal
    d = await addSlot('Monday', '12:00', '11:00', 'Backwards')
    await expect(d.getByRole('alert').filter({ hasText: 'Overlaps' })).toHaveCount(0)
    await d.getByRole('button', { name: 'Add slot' }).click()
    await expect(d.getByText('End time must be after start time')).toBeVisible()
    await d.getByLabel(/^To/).fill('12:00')
    await d.getByRole('button', { name: 'Add slot' }).click()
    await expect(d.getByText('End time must be after start time')).toBeVisible()
    expect(await readStore(page, 'schedules')).toHaveLength(2)
    // Escape on a dirty form prompts; the footer Cancel button should behave the same way
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Discard unsaved changes?' })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Keep editing' }).click()
    await expect(d.getByLabel(/^Label/)).toHaveValue('Backwards')
    await d.getByRole('button', { name: 'Cancel' }).click()
    const guard = page.getByRole('dialog').getByRole('heading', { name: 'Discard unsaved changes?' })
    await page.waitForTimeout(300)
    expect.soft(await guard.count(), 'footer Cancel bypasses the unsaved-changes guard that Escape/X show').toBe(1)
    if (await guard.count()) await page.getByRole('dialog').getByRole('button', { name: 'Discard' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // same times on a different day allowed
    d = await addSlot('Tuesday', '10:00', '11:00', 'Tue morning')
    await expect(d.getByRole('alert').filter({ hasText: 'Overlaps' })).toHaveCount(0)
    await d.getByRole('button', { name: 'Add slot' }).click()
    await expect(d).toBeHidden()
    let schedules = await readStore<{ id: string; weekday: number; startMinutes: number; endMinutes: number; label: string; trainerId: string; rev: number }>(page, 'schedules')
    expect(schedules).toHaveLength(3)
    expect(schedules.map((s) => [s.weekday, s.startMinutes, s.endMinutes, s.label]).sort()).toEqual([
      [1, 600, 660, 'Morning'],
      [1, 660, 720, 'Late morning'],
      [2, 600, 660, 'Tue morning'],
    ])
    expect(schedules.every((s) => s.trainerId === trainerId)).toBe(true)
    // sorted by weekday then start
    const slotRows = page.getByRole('heading', { name: 'Weekly schedule' }).locator('xpath=ancestor::*[contains(@class,"rounded-2xl")][1]').getByRole('listitem')
    await expect(slotRows).toHaveCount(3)
    await expect(slotRows.nth(0)).toContainText('Monday')
    await expect(slotRows.nth(0)).toContainText('10:00 am – 11:00 am')
    await expect(slotRows.nth(1)).toContainText('11:00 am – 12:00 pm')
    await expect(slotRows.nth(2)).toContainText('Tuesday')

    // edit a slot into an overlap: edit "Late morning" to 10:30–12:00
    await slotRows.nth(1).getByRole('button', { name: 'Edit slot' }).click()
    d = page.getByRole('dialog')
    await expect(d.getByRole('heading', { name: 'Edit slot' })).toBeVisible()
    await expect(d.getByLabel(/^From/)).toHaveValue('11:00')
    await expect(d.getByLabel(/^To/)).toHaveValue('12:00')
    await expect(d.getByLabel(/^Label/)).toHaveValue('Late morning')
    // editing itself should not warn about itself
    await expect(d.getByRole('alert').filter({ hasText: 'Overlaps' })).toHaveCount(0)
    await d.getByLabel(/^From/).fill('10:30')
    await expect(d.getByRole('alert')).toContainText('Overlaps “Morning”')
    await d.getByRole('button', { name: 'Save' }).click()
    await expect(d.getByText(/Overlaps "Morning" on Monday/)).toBeVisible()
    schedules = await readStore(page, 'schedules')
    expect(schedules.find((s) => s.label === 'Late morning')?.startMinutes).toBe(660)
    // edit moves it to another day (same times) → fine
    await d.getByLabel(/^Day/).selectOption('Wednesday')
    await expect(d.getByRole('alert').filter({ hasText: 'Overlaps “' })).toHaveCount(0)
    await d.getByLabel(/^Label/).fill('Wed slot')
    await d.getByRole('button', { name: 'Save' }).click()
    await expect(d).toBeHidden()
    await expect(page.getByRole('status').filter({ hasText: 'Slot updated' })).toBeVisible()
    schedules = await readStore(page, 'schedules')
    const wed = schedules.find((s) => s.label === 'Wed slot')!
    expect(wed).toMatchObject({ weekday: 3, startMinutes: 630, endMinutes: 720, rev: 2 })

    // delete slot with confirm
    await slotRows.nth(2).getByRole('button', { name: 'Delete slot' }).click()
    d = page.getByRole('dialog')
    await expect(d.getByRole('heading', { name: 'Delete this slot?' })).toBeVisible()
    await expect(d).toContainText('Wednesday 10:30 am – 12:00 pm · Wed slot')
    await d.getByRole('button', { name: 'Cancel' }).click()
    await expect(d).toBeHidden()
    expect(await readStore(page, 'schedules')).toHaveLength(3)
    await slotRows.nth(2).getByRole('button', { name: 'Delete slot' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Slot removed' })).toBeVisible()
    await expect(slotRows).toHaveCount(2)
    schedules = await readStore(page, 'schedules')
    expect(schedules).toHaveLength(2)
    expect(schedules.some((s) => s.id === wed.id)).toBe(false)
    await page.goto('/trainers')
    await expect(page.getByText('0 assigned members · 2 schedule slots')).toBeVisible()
  })
})

// =====================================================================
// 3. EXPENSES
// =====================================================================
test.describe('expenses', () => {
  type Exp = { id: string; date: string; category: string; amountPaise: number; method: string; vendor?: string; note?: string; rev: number }

  const openAdd = async (page: Page) => {
    await page.getByRole('button', { name: 'Add expense' }).first().click()
    return page.getByRole('dialog')
  }

  test('amount edge cases, long strings, create/edit/delete with store verification', async ({ page }) => {
    await onboard(page, 'empty')
    await page.goto('/expenses')
    let dialog = await openAdd(page)
    const submit = () => dialog.getByRole('button', { name: 'Add expense' }).click()
    await expect(dialog.getByLabel(/^Date/)).toHaveValue(today())

    for (const [input, msg] of [
      ['0', 'Amount must be greater than zero'],
      ['-5', 'Amount cannot be negative'],
      ['abc', 'Enter a valid amount in rupees'],
      ['', 'Enter a valid amount in rupees'],
      ['1.234', 'Enter a valid amount in rupees'],
      ['1e3', 'Enter a valid amount in rupees'],
      ['0.00', 'Amount must be greater than zero'],
    ] as const) {
      await dialog.getByLabel(/^Amount/).fill(input)
      await submit()
      await expect(dialog.getByText(msg), `amount "${input}"`).toBeVisible()
      await expect(dialog.getByLabel(/^Amount/)).toHaveValue(input)
    }
    expect(await readStore(page, 'expenses')).toHaveLength(0)

    // vendor > 80 and note > 300 are rejected
    await dialog.getByLabel(/^Amount/).fill('10')
    await dialog.getByLabel(/^Vendor/).fill('v'.repeat(81))
    await dialog.getByLabel(/^Note/).fill('n'.repeat(301))
    await submit()
    await expect(dialog.getByRole('alert')).toHaveCount(2)
    expect(await readStore(page, 'expenses')).toHaveLength(0)

    // 0.01 → 1 paise, with category/method, max-length vendor/note
    await dialog.getByLabel(/^Amount/).fill('0.01')
    await dialog.getByLabel(/^Category/).selectOption('utilities')
    await dialog.getByLabel(/^Paid by/).selectOption('upi')
    await dialog.getByLabel(/^Vendor/).fill('V'.repeat(80))
    await dialog.getByLabel(/^Note/).fill('N'.repeat(300))
    await submit()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('status').filter({ hasText: 'Expense recorded' })).toBeVisible()
    let exps = await readStore<Exp>(page, 'expenses')
    expect(exps).toHaveLength(1)
    expect(exps[0]).toMatchObject({ amountPaise: 1, category: 'utilities', method: 'upi', date: today(), vendor: 'V'.repeat(80), note: 'N'.repeat(300) })
    await expect(page.getByRole('table')).toContainText('₹0.01')
    await expect(page.getByRole('table')).toContainText('Utilities')
    await expect(page.getByRole('table')).toContainText('UPI')

    // Indian grouping with paise
    dialog = await openAdd(page)
    await dialog.getByLabel(/^Amount/).fill('1,00,000.50')
    await dialog.getByLabel(/^Category/).selectOption('rent')
    await dialog.getByLabel(/^Paid by/).selectOption('bank')
    await dialog.getByLabel(/^Vendor/).fill('  Landlord  ')
    await submit()
    await expect(dialog).toBeHidden()
    exps = await readStore<Exp>(page, 'expenses')
    const rent = exps.find((e) => e.category === 'rent')!
    expect(rent).toMatchObject({ amountPaise: 10000050, method: 'bank', vendor: 'Landlord' })
    expect(rent.note).toBeUndefined()
    await expect(page.getByRole('table')).toContainText('₹1,00,000.50')
    await expect(statCard(page, 'Total in period')).toContainText('₹1,00,000.51')
    await expect(statCard(page, 'Total in period')).toContainText('2 records')
    await expect(statCard(page, 'Rent')).toContainText('₹1,00,000.50')
    await expect(statCard(page, 'Rent')).toContainText('100% of total')

    // "₹ 2,500" with currency symbol and spaces, every category and method accepted
    const cats = ['salary', 'equipment', 'maintenance', 'marketing', 'supplies', 'other']
    const methods = ['cash', 'upi', 'bank', 'card', 'cash', 'card']
    for (let i = 0; i < cats.length; i++) {
      dialog = await openAdd(page)
      await dialog.getByLabel(/^Amount/).fill(i === 0 ? '₹ 2,500' : String(100 + i))
      await dialog.getByLabel(/^Category/).selectOption(cats[i])
      await dialog.getByLabel(/^Paid by/).selectOption(methods[i])
      await submit()
      await expect(dialog).toBeHidden()
    }
    exps = await readStore<Exp>(page, 'expenses')
    expect(exps).toHaveLength(8)
    expect(exps.find((e) => e.category === 'salary')?.amountPaise).toBe(250000)
    expect(new Set(exps.map((e) => e.category)).size).toBe(8)

    // edit then verify (amount prefilled from paise)
    const row = page.getByRole('row').filter({ hasText: 'Landlord' })
    await row.getByRole('button', { name: 'Edit expense' }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Edit expense' })).toBeVisible()
    await expect(dialog.getByLabel(/^Amount/)).toHaveValue('100000.50')
    await expect(dialog.getByLabel(/^Category/)).toHaveValue('rent')
    await expect(dialog.getByLabel(/^Vendor/)).toHaveValue('Landlord')
    await dialog.getByLabel(/^Amount/).fill('45000')
    await dialog.getByLabel(/^Date/).fill(addDays(today(), -1))
    await dialog.getByLabel(/^Note/).fill('October rent')
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('status').filter({ hasText: 'Expense updated' })).toBeVisible()
    exps = await readStore<Exp>(page, 'expenses')
    const rent2 = exps.find((e) => e.id === rent.id)!
    expect(rent2).toMatchObject({ amountPaise: 4500000, date: addDays(today(), -1), note: 'October rent', vendor: 'Landlord', rev: 2 })
    await expect(page.getByRole('row').filter({ hasText: 'Landlord' })).toContainText('₹45,000.00')
    await expect(page.getByRole('row').filter({ hasText: 'Landlord' })).toContainText('Landlord · October rent')

    // the stat totals equal the sum of what is listed
    const sum = exps.reduce((s, e) => s + e.amountPaise, 0)
    await expect(statCard(page, 'Total in period')).toContainText(inr(sum))
    await expect(statCard(page, 'Total in period')).toContainText('8 records')

    // delete: cancel keeps, confirm removes
    const delRow = page.getByRole('row').filter({ hasText: 'Utilities' })
    await delRow.getByRole('button', { name: 'Delete expense' }).click()
    dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Delete this expense?' })).toBeVisible()
    await expect(dialog).toContainText(`Utilities · ₹0.01 on ${formatDate(today())}`)
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toBeHidden()
    expect(await readStore(page, 'expenses')).toHaveLength(8)
    await delRow.getByRole('button', { name: 'Delete expense' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Expense deleted' })).toBeVisible()
    exps = await readStore<Exp>(page, 'expenses')
    expect(exps).toHaveLength(7)
    expect(exps.some((e) => e.category === 'utilities')).toBe(false)
    await expect(page.getByRole('row').filter({ hasText: 'Utilities' })).toHaveCount(0)
    await expect(statCard(page, 'Total in period')).toContainText(inr(sum - 1))
    await expect(statCard(page, 'Total in period')).toContainText('7 records')
  })

  test('period presets, custom range, category filter, totals, pagination at 25', async ({ page }) => {
    await onboard(page, 'empty')
    const t = today()
    const seed: Exp[] = [
      { date: t, category: 'rent', amountPaise: 100000, method: 'bank' },
      { date: addDays(t, -3), category: 'salary', amountPaise: 200000, method: 'cash' },
      { date: addDays(t, -6), category: 'rent', amountPaise: 300000, method: 'bank' },
      { date: addDays(t, -7), category: 'supplies', amountPaise: 400000, method: 'upi' },
      { date: addDays(t, -29), category: 'rent', amountPaise: 500000, method: 'card' },
      { date: addDays(t, -30), category: 'other', amountPaise: 600000, method: 'cash' },
      { date: addDays(t, -89), category: 'salary', amountPaise: 700000, method: 'bank' },
      { date: addDays(t, -90), category: 'rent', amountPaise: 800000, method: 'bank' },
      { date: `${t.slice(0, 4)}-01-01`, category: 'marketing', amountPaise: 900000, method: 'upi' },
      { date: `${Number(t.slice(0, 4)) - 1}-12-31`, category: 'rent', amountPaise: 1000000, method: 'bank' },
      { date: addDays(t, 1), category: 'rent', amountPaise: 1100000, method: 'bank' }, // future, excluded from presets
    ].map((e, i) => stamp('exp', e, i) as unknown as Exp)
    await putStore(page, 'expenses', seed)
    await page.goto('/expenses')

    const all = await readStore<Exp>(page, 'expenses')
    expect(all).toHaveLength(11)
    const expectPeriod = async (start: string, end: string, category = 'all') => {
      const filtered = all.filter((e) => e.date >= start && e.date <= end && (category === 'all' || e.category === category))
      const total = filtered.reduce((s, e) => s + e.amountPaise, 0)
      await expect(statCard(page, 'Total in period')).toContainText(inr(total))
      await expect(statCard(page, 'Total in period')).toContainText(`${filtered.length} record${filtered.length === 1 ? '' : 's'}`)
      if (filtered.length) await expect(page.getByRole('table').getByRole('row')).toHaveCount(filtered.length + 1)
      else await expect(page.getByText('No expenses in this period')).toBeVisible()
      return filtered
    }

    // default: this month
    await expectPeriod(t.slice(0, 7) + '-01', t)
    await page.getByRole('tab', { name: '7 days' }).click()
    const seven = await expectPeriod(addDays(t, -6), t)
    expect(seven).toHaveLength(3)
    await page.getByRole('tab', { name: '30 days' }).click()
    expect(await expectPeriod(addDays(t, -29), t)).toHaveLength(5)
    await page.getByRole('tab', { name: '90 days' }).click()
    expect(await expectPeriod(addDays(t, -89), t)).toHaveLength(7)
    await page.getByRole('tab', { name: 'This year' }).click()
    await expectPeriod(t.slice(0, 4) + '-01-01', t)
    await page.getByRole('tab', { name: 'This month' }).click()
    await expectPeriod(t.slice(0, 7) + '-01', t)

    // category filter + stat cards per category
    await page.getByRole('tab', { name: '30 days' }).click()
    await page.getByLabel('Category', { exact: true }).selectOption('rent')
    const rent30 = await expectPeriod(addDays(t, -29), t, 'rent')
    expect(rent30).toHaveLength(3)
    await expect(statCard(page, 'Rent')).toContainText(inr(rent30.reduce((s, e) => s + e.amountPaise, 0)))
    await expect(statCard(page, 'Rent')).toContainText('100% of total')
    await page.getByLabel('Category', { exact: true }).selectOption('marketing')
    await expectPeriod(addDays(t, -29), t, 'marketing')
    await page.getByLabel('Category', { exact: true }).selectOption('all')
    await expectPeriod(addDays(t, -29), t)

    // custom range (includes the future row)
    await page.getByRole('tab', { name: 'Custom' }).click()
    await page.getByLabel('From date').fill(addDays(t, -90))
    await page.getByLabel('To date').fill(addDays(t, 1))
    const custom = await expectPeriod(addDays(t, -90), addDays(t, 1))
    expect(custom).toHaveLength(9)
    // custom range: start after end → should not produce an inverted, silent-empty range
    await page.getByLabel('From date').fill(addDays(t, 5))
    const fromVal = await page.getByLabel('From date').inputValue()
    const toVal = await page.getByLabel('To date').inputValue()
    expect.soft(fromVal <= toVal, `period picker accepted from=${fromVal} > to=${toVal}`).toBe(true)

    // pagination: 30 extra rows today
    const bulk = Array.from({ length: 30 }, (_, i) => stamp('exp', { date: t, category: 'supplies', amountPaise: 100 * (i + 1), method: 'cash', vendor: `Bulk ${i + 1}` }, 100 + i))
    await putStore(page, 'expenses', bulk)
    await page.reload()
    await page.getByRole('tab', { name: '7 days' }).click()
    const nav = page.getByRole('navigation', { name: 'Pagination' })
    await expect(nav).toContainText('1–25 of 33')
    await expect(nav).toContainText('1 / 2')
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(26)
    await expect(nav.getByRole('button', { name: 'Previous page' })).toBeDisabled()
    await nav.getByRole('button', { name: 'Next page' }).click()
    await expect(nav).toContainText('26–33 of 33')
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(9)
    await expect(nav.getByRole('button', { name: 'Next page' })).toBeDisabled()
    // total still covers all pages
    const sevenAll = (await readStore<Exp>(page, 'expenses')).filter((e) => e.date >= addDays(t, -6) && e.date <= t)
    await expect(statCard(page, 'Total in period')).toContainText(inr(sevenAll.reduce((s, e) => s + e.amountPaise, 0)))
    await expect(statCard(page, 'Total in period')).toContainText('33 records')
    // changing the filter resets to page 1
    await page.getByLabel('Category', { exact: true }).selectOption('supplies')
    await expect(nav).toContainText('1–25 of 30')
    await page.getByLabel('Category', { exact: true }).selectOption('all')
    await nav.getByRole('button', { name: 'Next page' }).click()
    await page.getByRole('tab', { name: '30 days' }).click()
    await expect(nav).toContainText('1–25 of 35')
  })
})

// =====================================================================
// 4. FOLLOW-UPS
// =====================================================================
test.describe('follow-ups', () => {
  type FU = { id: string; type: string; memberId?: string; leadName?: string; leadPhone?: string; leadEmail?: string; dueDate: string; status: string; completedAt?: string; note?: string; assignee?: string; rev: number }

  test('validation, lifecycle (create/edit/reschedule/done/reopen/delete), badges', async ({ page }) => {
    await onboard(page, 'empty')
    await addMember(page, 'Member One', '98200 00040')
    const member = (await readStore<{ id: string }>(page, 'members'))[0]
    await page.goto('/follow-ups')
    await expect(page.getByText('Nothing to follow up')).toBeVisible()
    await page.getByRole('button', { name: 'New follow-up' }).first().click()
    let d = page.getByRole('dialog')
    const typeSel = () => d.getByLabel(/^Type/)
    await expect(typeSel()).toHaveValue('expiry')
    await expect(d.getByLabel(/^Due date/)).toHaveValue(today())
    // member types require a member
    await d.getByRole('button', { name: 'Add follow-up' }).click()
    await expect(d.getByText('Choose a member')).toBeVisible()
    await typeSel().selectOption('payment')
    await d.getByRole('button', { name: 'Add follow-up' }).click()
    await expect(d.getByText('Choose a member')).toBeVisible()
    // lead requires a lead name, member picker hidden
    await typeSel().selectOption('lead')
    await expect(d.getByPlaceholder(/Search by name/)).toHaveCount(0)
    await d.getByRole('button', { name: 'Add follow-up' }).click()
    await expect(d.getByText('Enter the lead’s name')).toBeVisible()
    await d.getByLabel(/^Lead name/).fill('   ')
    await d.getByRole('button', { name: 'Add follow-up' }).click()
    await expect(d.getByText('Enter the lead’s name')).toBeVisible()
    // bad lead email
    await d.getByLabel(/^Lead name/).fill('Lead Person')
    await d.getByLabel(/^Email/).fill('nope')
    await d.getByRole('button', { name: 'Add follow-up' }).click()
    await expect(d.getByText('Enter a valid email address')).toBeVisible()
    await d.getByLabel(/^Email/).fill('lead@example.com')
    // due date validation
    await d.getByLabel(/^Due date/).fill('')
    await d.getByRole('button', { name: 'Add follow-up' }).click()
    await expect(d.getByText('Enter a valid date')).toBeVisible()
    expect(await readStore(page, 'followups')).toHaveLength(0)
    await d.getByLabel(/^Due date/).fill(addDays(today(), -1))
    await d.getByLabel(/^Phone/).fill('98100 00099')
    await d.getByLabel(/^Assignee/).fill('Reception')
    await d.getByLabel(/^Note/).fill('Asked about timings')
    await d.getByRole('button', { name: 'Add follow-up' }).click()
    await expect(d).toBeHidden()
    await expect(page.getByRole('status').filter({ hasText: 'Follow-up added' })).toBeVisible()
    let fus = await readStore<FU>(page, 'followups')
    expect(fus).toHaveLength(1)
    expect(fus[0]).toMatchObject({ type: 'lead', leadName: 'Lead Person', leadPhone: '98100 00099', leadEmail: 'lead@example.com', dueDate: addDays(today(), -1), status: 'open', assignee: 'Reception', note: 'Asked about timings' })
    expect(fus[0].memberId).toBeUndefined()
    const leadItem = page.getByRole('listitem').filter({ hasText: 'Lead Person' })
    await expect(leadItem.getByText('Overdue')).toBeVisible()
    await expect(leadItem).toContainText(`Due ${formatDate(addDays(today(), -1))} · Reception · 98100 00099`)
    await expect(page.getByRole('tab', { name: /Open/ })).toContainText('1')

    // "other" type needs no member; due today → badge
    await page.getByRole('button', { name: 'New follow-up' }).first().click()
    d = page.getByRole('dialog')
    await typeSel().selectOption('other')
    await d.getByLabel(/^Note/).fill('Order towels')
    await d.getByRole('button', { name: 'Add follow-up' }).click()
    await expect(d).toBeHidden()
    const otherItem = page.getByRole('listitem').filter({ hasText: 'Order towels' })
    await expect(otherItem.getByText('Due today')).toBeVisible()
    await expect(otherItem.getByRole('link')).toHaveCount(0)
    // an "Other" follow-up with no member is labelled "Lead" (contactFor falls back to leadName ?? 'Lead')
    await expect.soft(otherItem.locator('p').first(), '"Other" follow-up without a member is shown with the name "Lead"').not.toContainText('Lead', { timeout: 1500 })

    // member follow-up for tomorrow → no badge
    await page.getByRole('button', { name: 'New follow-up' }).first().click()
    d = page.getByRole('dialog')
    await typeSel().selectOption('expiry')
    await pickMember(page, d, 'Member One')
    await d.getByLabel(/^Due date/).fill(addDays(today(), 1))
    await d.getByLabel(/^Note/).fill('Renew soon')
    await d.getByRole('button', { name: 'Add follow-up' }).click()
    await expect(d).toBeHidden()
    const memItem = page.getByRole('listitem').filter({ hasText: 'Renew soon' })
    await expect(memItem.getByText('Overdue')).toHaveCount(0)
    await expect(memItem.getByText('Due today')).toHaveCount(0)
    await expect(memItem.getByRole('link', { name: 'Member One' })).toBeVisible()
    fus = await readStore<FU>(page, 'followups')
    expect(fus.find((f) => f.note === 'Renew soon')).toMatchObject({ type: 'expiry', memberId: member.id, dueDate: addDays(today(), 1) })
    // sorted by due date: overdue lead first, today second, tomorrow last
    const items = page.getByRole('heading', { name: 'To do' }).locator('xpath=ancestor::*[contains(@class,"rounded-2xl")][1]').getByRole('listitem')
    await expect(items).toHaveCount(3)
    await expect(items.nth(0)).toContainText('Lead Person')
    await expect(items.nth(1)).toContainText('Order towels')
    await expect(items.nth(2)).toContainText('Renew soon')

    // type filter
    await page.getByLabel('Type', { exact: true }).selectOption('lead')
    await expect(items).toHaveCount(1)
    await page.getByLabel('Type', { exact: true }).selectOption('all')

    // edit
    await leadItem.getByRole('button', { name: 'Edit' }).click()
    d = page.getByRole('dialog')
    await expect(d.getByRole('heading', { name: 'Edit follow-up' })).toBeVisible()
    await expect(d.getByLabel(/^Lead name/)).toHaveValue('Lead Person')
    await d.getByLabel(/^Note/).fill('Asked about yoga timings')
    await d.getByRole('button', { name: 'Save' }).click()
    await expect(d).toBeHidden()
    await expect(page.getByRole('status').filter({ hasText: 'Follow-up updated' })).toBeVisible()
    fus = await readStore<FU>(page, 'followups')
    expect(fus.find((f) => f.leadName === 'Lead Person')).toMatchObject({ note: 'Asked about yoga timings', rev: 2 })

    // switching type from member → lead should not keep the stale member link
    await memItem.getByRole('button', { name: 'Edit' }).click()
    d = page.getByRole('dialog')
    await expect(d.getByRole('button', { name: 'Clear selected member' })).toBeVisible()
    await typeSel().selectOption('lead')
    await d.getByLabel(/^Lead name/).fill('Converted Lead')
    await d.getByRole('button', { name: 'Save' }).click()
    await expect(d).toBeHidden()
    fus = await readStore<FU>(page, 'followups')
    const converted = fus.find((f) => f.leadName === 'Converted Lead')!
    expect(converted.type).toBe('lead')
    expect.soft(converted.memberId, 'lead follow-up still carries memberId after type switch').toBeUndefined()
    await expect.soft(page.getByRole('listitem').filter({ hasText: 'Renew soon' }), 'list still shows the member for a lead follow-up').toContainText('Converted Lead', { timeout: 1500 })

    // reschedule: +1 / +3 / +7 relative to today, then custom
    await leadItem.getByRole('button', { name: 'Reschedule' }).click()
    d = page.getByRole('dialog')
    await expect(d.getByRole('heading', { name: 'Reschedule follow-up' })).toBeVisible()
    await expect(d.getByLabel(/^New due date/)).toHaveValue(addDays(today(), 1)) // overdue → tomorrow
    await d.getByRole('button', { name: '+3 days' }).click()
    await expect(d.getByLabel(/^New due date/)).toHaveValue(addDays(today(), 3))
    await d.getByRole('button', { name: '+7 days' }).click()
    await expect(d.getByLabel(/^New due date/)).toHaveValue(addDays(today(), 7))
    await d.getByRole('button', { name: '+1 day' }).click()
    await expect(d.getByLabel(/^New due date/)).toHaveValue(addDays(today(), 1))
    // empty date must be refused
    await d.getByLabel(/^New due date/).fill('')
    await d.getByRole('button', { name: 'Reschedule' }).click()
    fus = await readStore<FU>(page, 'followups')
    const leadNow = fus.find((f) => f.leadName === 'Lead Person')!
    expect.soft(leadNow.dueDate, 'reschedule accepted an empty date').toBe(addDays(today(), -1))
    if (await d.isVisible()) {
      await d.getByLabel(/^New due date/).fill(addDays(today(), 10))
      await d.getByRole('button', { name: 'Reschedule' }).click()
      await expect(d).toBeHidden()
    } else {
      await leadItem.getByRole('button', { name: 'Reschedule' }).click()
      d = page.getByRole('dialog')
      await d.getByLabel(/^New due date/).fill(addDays(today(), 10))
      await d.getByRole('button', { name: 'Reschedule' }).click()
      await expect(d).toBeHidden()
    }
    await expect(page.getByRole('status').filter({ hasText: `Rescheduled to ${formatDate(addDays(today(), 10))}` })).toBeVisible()
    fus = await readStore<FU>(page, 'followups')
    expect(fus.find((f) => f.leadName === 'Lead Person')?.dueDate).toBe(addDays(today(), 10))
    await expect(leadItem.getByText('Overdue')).toHaveCount(0)
    // reschedule of a non-overdue item defaults to the day after its due date
    await leadItem.getByRole('button', { name: 'Reschedule' }).click()
    d = page.getByRole('dialog')
    await expect(d.getByLabel(/^New due date/)).toHaveValue(addDays(today(), 11))
    await d.getByRole('button', { name: 'Cancel' }).click()
    await expect(d).toBeHidden()

    // done → Done tab → reopen → delete
    await otherItem.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Marked done' })).toBeVisible()
    await expect(otherItem).toHaveCount(0)
    await expect(page.getByRole('tab', { name: /Open/ })).toContainText('2')
    await expect(page.getByRole('tab', { name: /Done/ })).toContainText('1')
    fus = await readStore<FU>(page, 'followups')
    const done = fus.find((f) => f.note === 'Order towels')!
    expect(done.status).toBe('done')
    expect(done.completedAt).toBeTruthy()
    await page.getByRole('tab', { name: /Done/ }).click()
    const doneItem = page.getByRole('listitem').filter({ hasText: 'Order towels' })
    await expect(doneItem).toContainText(`Completed ${formatDate(dateOf(done.completedAt!))}`)
    await expect(doneItem.getByRole('button', { name: 'Done' })).toHaveCount(0)
    await doneItem.getByRole('button', { name: 'Reopen' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Reopened' })).toBeVisible()
    fus = await readStore<FU>(page, 'followups')
    expect(fus.find((f) => f.note === 'Order towels')).toMatchObject({ status: 'open' })
    expect(fus.find((f) => f.note === 'Order towels')?.completedAt).toBeUndefined()
    await expect(page.getByText('No completed follow-ups')).toBeVisible()
    await page.getByRole('tab', { name: /Open/ }).click()
    await otherItem.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('tab', { name: /Done/ }).click()
    await doneItem.getByRole('button', { name: 'Delete' }).click()
    d = page.getByRole('dialog')
    await expect(d.getByRole('heading', { name: 'Delete this follow-up?' })).toBeVisible()
    await d.getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Deleted' })).toBeVisible()
    fus = await readStore<FU>(page, 'followups')
    expect(fus).toHaveLength(2)
    expect(fus.some((f) => f.note === 'Order towels')).toBe(false)
  })

  test('suggested section (sample data) and contact link hrefs', async ({ page }) => {
    await onboard(page, 'sample')
    const t = today()
    type M = { id: string; name: string; phone: string; email?: string; status: string }
    const members = await readStore<M>(page, 'members')
    const memberships = await readStore<{ memberId: string; startDate: string; endDate: string }>(page, 'memberships')
    const invoices = await readStore<{ id: string; memberId: string; status: string; totalPaise: number }>(page, 'invoices')
    const payments = await readStore<{ memberId: string; status: string; amountPaise: number }>(page, 'payments')
    const openFus = (await readStore<FU>(page, 'followups')).filter((f) => f.status === 'open')
    const balance = (m: M) => invoices.filter((i) => i.memberId === m.id && i.status === 'issued').reduce((s, i) => s + i.totalPaise, 0) - payments.filter((p) => p.memberId === m.id && p.status === 'recorded').reduce((s, p) => s + p.amountPaise, 0)
    const owing = members.filter((m) => m.status !== 'archived' && balance(m) > 0 && !openFus.some((f) => f.memberId === m.id && f.type === 'payment'))
    expect(owing.length).toBeGreaterThan(0)

    await page.goto('/follow-ups')
    const suggested = page.getByRole('heading', { name: 'Suggested' }).locator('xpath=ancestor::*[contains(@class,"rounded-2xl")][1]')
    await expect(suggested).toBeVisible()
    for (const m of owing) {
      const li = suggested.getByRole('listitem').filter({ hasText: m.name }).filter({ hasText: 'Payment' })
      await expect(li).toContainText(`owes ${inr(balance(m))}`)
    }
    // an expiring member (Diya) already has an open expiry follow-up so must not be suggested; Vihaan's trial ended within 14 days → suggested
    const vihaan = members.find((m) => m.name.includes('Vihaan'))!
    const vMs = memberships.find((ms) => ms.memberId === vihaan.id)!
    await expect(suggested.getByRole('listitem').filter({ hasText: 'Vihaan' })).toContainText(`10-day trial ended ${formatDate(vMs.endDate)}`)
    await expect(suggested.getByRole('listitem').filter({ hasText: 'Diya' })).toHaveCount(0)

    // add a prefilled payment follow-up for the first owing member
    const target = owing[0]
    const li = suggested.getByRole('listitem').filter({ hasText: target.name }).filter({ hasText: 'Payment' })
    await li.getByRole('button', { name: 'Add' }).click()
    const d = page.getByRole('dialog')
    await expect(d.getByLabel(/^Type/)).toHaveValue('payment')
    await expect(d.getByText(target.name, { exact: true })).toBeVisible()
    await expect(d.getByLabel(/^Due date/)).toHaveValue(t)
    await expect(d.getByLabel(/^Note/)).toHaveValue(`Collect outstanding ${inr(balance(target))}`)
    await d.getByRole('button', { name: 'Add follow-up' }).click()
    await expect(d).toBeHidden()
    const created = (await readStore<FU>(page, 'followups')).find((f) => f.memberId === target.id && f.type === 'payment')!
    expect(created).toMatchObject({ status: 'open', dueDate: t, note: `Collect outstanding ${inr(balance(target))}` })
    // suggestion disappears once a follow-up exists
    await expect(li).toHaveCount(0)

    // contact hrefs
    const todo = page.getByRole('heading', { name: 'To do' }).locator('xpath=ancestor::*[contains(@class,"rounded-2xl")][1]')
    const row = todo.getByRole('listitem').filter({ hasText: target.name }).filter({ hasText: 'Collect outstanding' })
    const digits = target.phone.replace(/\D/g, '')
    expect(digits).toHaveLength(10)
    await expect(row.getByRole('link', { name: 'Call' })).toHaveAttribute('href', `tel:${digits}`)
    const wa = await row.getByRole('link', { name: 'WhatsApp' }).getAttribute('href')
    const waUrl = new URL(wa!)
    expect(waUrl.origin + waUrl.pathname).toBe(`https://wa.me/91${digits}`)
    expect(waUrl.searchParams.get('text')).toBe(`Hi ${target.name.replace(/^Sample\s+/, '')}, this is Test Gym. Collect outstanding ${inr(balance(target))}`)
    await expect(row.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('target', '_blank')
    await expect(row.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('rel', /noopener/)
    if (target.email) {
      const mail = await row.getByRole('link', { name: 'Email' }).getAttribute('href')
      expect(mail).toBe(`mailto:${target.email}?subject=${encodeURIComponent('Test Gym')}&body=${encodeURIComponent(`Hi ${target.name.replace(/^Sample\s+/, '')}, this is Test Gym. Collect outstanding ${inr(balance(target))}`)}`)
    } else {
      await expect(row.getByRole('link', { name: 'Email' })).toHaveCount(0)
    }
    // member with email: Kabir (sample payment follow-up)
    const kabir = members.find((m) => m.name.includes('Kabir'))!
    const kRow = todo.getByRole('listitem').filter({ hasText: 'Kabir' })
    const mail = await kRow.getByRole('link', { name: 'Email' }).getAttribute('href')
    const mailUrl = new URL(mail!)
    expect(mailUrl.protocol).toBe('mailto:')
    expect(mailUrl.pathname).toBe(kabir.email)
    expect(mailUrl.searchParams.get('subject')).toBe('Test Gym')
    expect(mailUrl.searchParams.get('body')).toBe('Hi Kabir Singh, this is Test Gym. Collect remaining ₹500 for monthly plan')

    // lead with +country phone: digits kept as-is, no 91 prefix; 10-digit lead phone gets 91
    const tara = todo.getByRole('listitem').filter({ hasText: 'Tara Menon' })
    await expect(tara.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/919810000099\?text=/)
    await expect(tara.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:9810000099')
    await expect(tara.getByRole('link', { name: 'Email' })).toHaveCount(0)
    await page.getByRole('button', { name: 'New follow-up' }).first().click()
    const nd = page.getByRole('dialog')
    await nd.getByLabel(/^Type/).selectOption('lead')
    await nd.getByLabel(/^Lead name/).fill('Intl Lead')
    await nd.getByLabel(/^Phone/).fill('+1 (555) 123-4567')
    await nd.getByLabel(/^Note/).fill('Note with & and ? chars')
    await nd.getByRole('button', { name: 'Add follow-up' }).click()
    await expect(nd).toBeHidden()
    const intl = todo.getByRole('listitem').filter({ hasText: 'Intl Lead' })
    await expect(intl.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+15551234567')
    const intlWa = new URL((await intl.getByRole('link', { name: 'WhatsApp' }).getAttribute('href'))!)
    expect(intlWa.pathname).toBe('/15551234567')
    expect(intlWa.searchParams.get('text')).toBe('Hi Intl Lead, this is Test Gym. Note with & and ? chars')
  })
})

// =====================================================================
// 5. REPORTS
// =====================================================================
test.describe('reports', () => {
  type Pay = { id: string; status: string; receivedAt: string; amountPaise: number; invoiceId?: string; memberId: string; method: string }
  type Inv = { id: string; number: string; status: string; issueDate: string; totalPaise: number; memberId: string; subtotalPaise: number; discountPaise: number }
  type Adj = { invoiceId: string; amountPaise: number; createdAt: string }
  type Exp = { date: string; amountPaise: number; category: string }
  type Ms = { memberId: string; createdAt: string; renewalOfId?: string }
  type Att = { memberId: string; checkInAt: string; checkOutAt: string | null }

  test('stat cards and attendance summary match IndexedDB for the default period', async ({ page }) => {
    await onboard(page, 'sample')
    const t = today()
    const start = t.slice(0, 7) + '-01'
    const [payments, invoices, adjustments, expenses, memberships, attendance] = await Promise.all([
      readStore<Pay>(page, 'payments'),
      readStore<Inv>(page, 'invoices'),
      readStore<Adj>(page, 'adjustments'),
      readStore<Exp>(page, 'expenses'),
      readStore<Ms>(page, 'memberships'),
      readStore<Att>(page, 'attendance'),
    ])
    const inP = (d: string) => d >= start && d <= t
    const recv = payments.filter((p) => p.status === 'recorded' && inP(dateOf(p.receivedAt)))
    const received = recv.reduce((s, p) => s + p.amountPaise, 0)
    const inv = invoices.filter((i) => i.status === 'issued' && inP(i.issueDate))
    const invoiced = inv.reduce((s, i) => s + i.totalPaise, 0)
    const exp = expenses.filter((e) => inP(e.date))
    const spent = exp.reduce((s, e) => s + e.amountPaise, 0)
    const balances = invoices.map((i) => {
      const adj = adjustments.filter((a) => a.invoiceId === i.id).reduce((s, a) => s + a.amountPaise, 0)
      const due = i.status === 'void' ? 0 : i.totalPaise + adj
      const paid = payments.filter((p) => p.invoiceId === i.id && p.status === 'recorded').reduce((s, p) => s + p.amountPaise, 0)
      return due - paid
    }).filter((b) => b > 0)
    const outstanding = balances.reduce((s, b) => s + b, 0)
    const visits = attendance.filter((a) => inP(dateOf(a.checkInAt)))
    const unique = new Set(visits.map((a) => a.memberId)).size
    const newMs = memberships.filter((m) => !m.renewalOfId && inP(dateOf(m.createdAt))).length
    const renewals = memberships.filter((m) => m.renewalOfId && inP(dateOf(m.createdAt))).length
    expect(received).toBeGreaterThan(0)
    expect(spent).toBeGreaterThan(0)

    await page.goto('/reports')
    await expect(page.getByText(`${formatDate(start)} – ${formatDate(t)} · Asia/Kolkata`)).toBeVisible()
    await expect(statCard(page, 'Revenue received')).toContainText(inr(received))
    await expect(statCard(page, 'Revenue received')).toContainText(`${recv.length} payment${recv.length === 1 ? '' : 's'}`)
    await expect(statCard(page, 'Invoiced')).toContainText(inr(invoiced))
    await expect(statCard(page, 'Invoiced')).toContainText(`${inv.length} invoice${inv.length === 1 ? '' : 's'} issued`)
    await expect(statCard(page, 'Outstanding (all time)')).toContainText(inr(outstanding))
    await expect(statCard(page, 'Outstanding (all time)')).toContainText(/\d+ members? owe money/)
    await expect(statCard(page, 'Expenses')).toContainText(inr(spent))
    await expect(statCard(page, 'Expenses')).toContainText(`${exp.length} record${exp.length === 1 ? '' : 's'}`)
    await expect(statCard(page, 'Net cash flow')).toContainText(inr(received - spent))
    await expect(page.getByText(`${visits.length} visits by ${unique} member${unique === 1 ? '' : 's'} · ${newMs} new · ${renewals} renewal${renewals === 1 ? '' : 's'}`)).toBeVisible()
    // received by method list
    const byMethod = new Map<string, number>()
    for (const p of recv) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountPaise)
    const methodCard = page.getByRole('heading', { name: 'Received by method' }).locator('xpath=ancestor::*[contains(@class,"rounded-2xl")][1]')
    for (const [k, v] of byMethod) await expect(methodCard.getByRole('listitem').filter({ hasText: new RegExp(`^${k === 'upi' ? 'UPI' : k[0].toUpperCase() + k.slice(1)}`) })).toContainText(inr(v))
    const catCard = page.getByRole('heading', { name: 'Expenses by category' }).locator('xpath=ancestor::*[contains(@class,"rounded-2xl")][1]')
    const byCat = new Map<string, number>()
    for (const e of exp) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amountPaise)
    await expect(catCard.getByRole('listitem')).toHaveCount(byCat.size)
    for (const [k, v] of byCat) await expect(catCard.getByRole('listitem').filter({ hasText: new RegExp(`^${k[0].toUpperCase() + k.slice(1)}`) })).toContainText(inr(v))

    // 7 days
    await page.getByRole('tab', { name: '7 days' }).click()
    const s7 = addDays(t, -6)
    const recv7 = payments.filter((p) => p.status === 'recorded' && dateOf(p.receivedAt) >= s7 && dateOf(p.receivedAt) <= t).reduce((s, p) => s + p.amountPaise, 0)
    const exp7 = expenses.filter((e) => e.date >= s7 && e.date <= t).reduce((s, e) => s + e.amountPaise, 0)
    await expect(statCard(page, 'Revenue received')).toContainText(inr(recv7))
    await expect(statCard(page, 'Expenses')).toContainText(inr(exp7))
    await expect(statCard(page, 'Net cash flow')).toContainText(inr(recv7 - exp7))
    await expect(statCard(page, 'Outstanding (all time)')).toContainText(inr(outstanding))

    // custom period with start > end
    await page.getByRole('tab', { name: 'Custom' }).click()
    await page.getByLabel('From date').fill(addDays(t, 5))
    const fromVal = await page.getByLabel('From date').inputValue()
    const toVal = await page.getByLabel('To date').inputValue()
    expect.soft(fromVal <= toVal, `reports accepted from=${fromVal} > to=${toVal}`).toBe(true)
    await expect(statCard(page, 'Revenue received')).toBeVisible() // page did not crash
    // custom period in the past: 90 days ago to 60 days ago → recompute
    await page.getByLabel('To date').fill(addDays(t, -60))
    await page.getByLabel('From date').fill(addDays(t, -90))
    const a = addDays(t, -90)
    const b = addDays(t, -60)
    const recvC = payments.filter((p) => p.status === 'recorded' && dateOf(p.receivedAt) >= a && dateOf(p.receivedAt) <= b)
    const expC = expenses.filter((e) => e.date >= a && e.date <= b)
    await expect(page.getByText(`${formatDate(a)} – ${formatDate(b)} · Asia/Kolkata`)).toBeVisible()
    await expect(statCard(page, 'Revenue received')).toContainText(inr(recvC.reduce((s, p) => s + p.amountPaise, 0)))
    await expect(statCard(page, 'Revenue received')).toContainText(`${recvC.length} payment${recvC.length === 1 ? '' : 's'}`)
    await expect(statCard(page, 'Expenses')).toContainText(inr(expC.reduce((s, e) => s + e.amountPaise, 0)))
  })

  test('CSV exports: structure, formatting, escaping, period filtering', async ({ page }) => {
    await onboard(page, 'sample')
    const t = today()
    const start = t.slice(0, 7) + '-01'
    // add rows designed to stress escaping: formula-like name, + phone, comma/quote/newline in notes
    await page.goto('/members/new')
    await page.getByLabel('Full name').fill('=SUM(A1) "Quoted", Comma')
    await page.getByLabel(/^Phone/).fill('+91 98200 77777')
    await page.getByLabel('Notes', { exact: true }).fill('line1\nline2')
    await page.getByRole('button', { name: 'Add member' }).click()
    await expect(page).toHaveURL(/\/members\/mem_/)
    await page.goto('/expenses')
    await page.getByRole('button', { name: 'Add expense' }).first().click()
    const ed = page.getByRole('dialog')
    await ed.getByLabel(/^Amount/).fill('1234.5')
    await ed.getByLabel(/^Vendor/).fill('-Dash Vendor')
    await ed.getByLabel(/^Note/).fill('@mention, "quoted"\nsecond line')
    await ed.getByRole('button', { name: 'Add expense' }).click()
    await expect(ed).toBeHidden()

    const [payments, invoices, expenses, attendance, members] = await Promise.all([
      readStore<Pay>(page, 'payments'),
      readStore<Inv>(page, 'invoices'),
      readStore<Exp & { vendor?: string; note?: string }>(page, 'expenses'),
      readStore<Att>(page, 'attendance'),
      readStore<{ id: string; name: string; phone: string; status: string }>(page, 'members'),
    ])
    const inP = (d: string) => d >= start && d <= t

    await page.goto('/reports')
    const checkShape = (rows: string[][], what: string) => {
      const header = rows[0]
      for (let i = 1; i < rows.length; i++) expect(rows[i].length, `${what} row ${i} has ${rows[i].length} cols; header has ${header.length}: ${JSON.stringify(rows[i])}`).toBe(header.length)
    }
    const amountRe = /^'?-?\d+\.\d{2}$/
    // Timestamps are exported as wall-clock time in the gym timezone, not UTC instants.
    const isoInstant = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/
    const isoDate = /^\d{4}-\d{2}-\d{2}$/

    // payments
    const pay = await downloadCsv(page, 'Payments')
    expect(pay.name).toBe(`gymbook-payments-${start}_to_${t}.csv`)
    expect(pay.text.startsWith('﻿')).toBe(true)
    expect(pay.rows[0]).toEqual(['Received at (gym time)', 'Member', 'Phone', 'Amount (INR)', 'Method', 'Invoice', 'Status', 'Reference', 'Note'])
    checkShape(pay.rows, 'payments')
    const payExpected = payments.filter((p) => inP(dateOf(p.receivedAt)))
    expect(pay.rows.length - 1).toBe(payExpected.length)
    for (const r of pay.rows.slice(1)) {
      expect(r[0]).toMatch(isoInstant)
      expect(r[3]).toMatch(amountRe)
      expect(['Cash', 'UPI', 'Bank transfer', 'Card', 'Bank']).toContain(r[4])
    }
    expect(pay.rows.slice(1).map((r) => r[3]).sort()).toEqual(payExpected.map((p) => (p.amountPaise / 100).toFixed(2)).sort())
    await expect(page.getByRole('status').filter({ hasText: 'CSV exported' })).toBeVisible()

    // invoices
    const inv = await downloadCsv(page, 'Invoices')
    expect(inv.rows[0]).toEqual(['Invoice', 'Issued', 'Member', 'Phone', 'Subtotal (INR)', 'Discount (INR)', 'Adjustments (INR)', 'Total due (INR)', 'Paid (INR)', 'Balance (INR)', 'Status'])
    checkShape(inv.rows, 'invoices')
    const invExpected = invoices.filter((i) => inP(i.issueDate))
    expect(inv.rows.length - 1).toBe(invExpected.length)
    expect(inv.rows.slice(1).map((r) => r[0]).sort()).toEqual(invExpected.map((i) => i.number).sort())
    for (const r of inv.rows.slice(1)) {
      expect(r[1]).toMatch(isoDate)
      for (const c of [4, 5, 6, 7, 8, 9]) expect(r[c]).toMatch(amountRe)
      expect(['paid', 'partial', 'unpaid', 'void', 'credit']).toContain(r[10])
    }

    // expenses
    const ex = await downloadCsv(page, 'Expenses')
    expect(ex.rows[0]).toEqual(['Date', 'Category', 'Amount (INR)', 'Method', 'Vendor', 'Note'])
    checkShape(ex.rows, 'expenses')
    const exExpected = expenses.filter((e) => inP(e.date))
    expect(ex.rows.length - 1).toBe(exExpected.length)
    for (const r of ex.rows.slice(1)) {
      expect(r[0]).toMatch(isoDate)
      expect(r[2]).toMatch(amountRe)
    }
    const stress = ex.rows.find((r) => r[2] === '1234.50')!
    expect(stress).toBeTruthy()
    expect(stress[4]).toBe("'-Dash Vendor")
    expect(stress[5]).toBe("'@mention, \"quoted\"\nsecond line")
    expect(ex.text).toContain('"\'@mention, ""quoted""\nsecond line"')
    const exDates = ex.rows.slice(1).map((r) => r[0])
    expect(exDates).toEqual([...exDates].sort())

    // attendance
    const at = await downloadCsv(page, 'Attendance')
    expect(at.rows[0]).toEqual(['Check-in (gym time)', 'Check-out (gym time)', 'Member', 'Phone', 'Override reason', 'Note'])
    checkShape(at.rows, 'attendance')
    const atExpected = attendance.filter((a) => inP(dateOf(a.checkInAt)))
    expect(at.rows.length - 1).toBe(atExpected.length)
    const openCount = atExpected.filter((a) => a.checkOutAt === null).length
    expect(at.rows.slice(1).filter((r) => r[1] === '').length).toBe(openCount)
    for (const r of at.rows.slice(1)) {
      expect(r[0]).toMatch(isoInstant)
      if (r[1]) expect(r[1]).toMatch(isoInstant)
      expect(r[2]).not.toBe('')
    }

    // members (full list, including archived)
    const me = await downloadCsv(page, 'Members')
    expect(me.name).toBe(`gymbook-members-${t}.csv`)
    expect(me.rows[0]).toEqual(['Name', 'Phone', 'Email', 'Joined', 'Status', 'Current plan', 'Plan start', 'Plan end', 'Membership state', 'Balance (INR)', 'Last visit (gym time)'])
    checkShape(me.rows, 'members')
    expect(me.rows.length - 1).toBe(members.length)
    expect(me.rows.slice(1).filter((r) => r[4] === 'archived').length).toBe(members.filter((m) => m.status === 'archived').length)
    const stressRow = me.rows.find((r) => r[0].includes('SUM(A1)'))!
    expect(stressRow[0]).toBe("'=SUM(A1) \"Quoted\", Comma")
    expect(me.text).toContain('"\'=SUM(A1) ""Quoted"", Comma"')
    expect(stressRow[1]).toBe("'+91 98200 77777")
    expect(stressRow[8]).toBe('none')
    expect(stressRow[9]).toBe('0.00')
    for (const r of me.rows.slice(1)) {
      expect(r[3]).toMatch(isoDate)
      expect(r[9]).toMatch(amountRe)
      if (r[10]) expect(r[10]).toMatch(isoInstant)
      expect(['active', 'expiring', 'expired', 'upcoming', 'none']).toContain(r[8])
    }

    // export for a period with no data gives header only
    await page.getByRole('tab', { name: 'Custom' }).click()
    await page.getByLabel('From date').fill('2000-01-01')
    await page.getByLabel('To date').fill('2000-01-31')
    const empty = await downloadCsv(page, 'Payments')
    expect(empty.name).toBe('gymbook-payments-2000-01-01_to_2000-01-31.csv')
    expect(empty.rows).toHaveLength(1)
    await expect(page.getByText('No data for this period').first()).toBeVisible()
  })
})
