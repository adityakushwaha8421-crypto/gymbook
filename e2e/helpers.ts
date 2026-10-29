import { expect, type Page } from '@playwright/test'

/** Complete first-launch onboarding. Each Playwright test gets a fresh browser context, so storage starts empty. */
export async function onboard(page: Page, mode: 'sample' | 'empty', gymName = 'Test Gym') {
  await page.goto('/')
  await page.getByLabel('Gym name').fill(gymName)
  await page.getByRole('button', { name: mode === 'sample' ? /Labelled sample data/ : /Start empty/ }).click()
  await page.getByRole('button', { name: /open GymBook/i }).click()
  await expect(page).toHaveTitle(/Dashboard · GymBook/)
}

export async function createPlan(page: Page, name: string, duration: number, unit: 'months' | 'days', priceRupees: string) {
  await page.goto('/plans')
  await page.getByRole('button', { name: 'New plan' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Plan name').fill(name)
  await dialog.getByLabel('Duration').fill(String(duration))
  await dialog.getByLabel('Unit').selectOption(unit)
  await dialog.getByLabel('Price').fill(priceRupees)
  await dialog.getByRole('button', { name: 'Create plan' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
}

export async function addMember(page: Page, name: string, phone: string) {
  await page.goto('/members/new')
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel(/^Phone/).fill(phone)
  await page.getByRole('button', { name: 'Add member' }).click()
  await expect(page).toHaveURL(/\/members\/mem_/)
  await expect(page).toHaveTitle(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  return page.url()
}

/** Sell a plan to the member currently open on the page. Returns the invoice URL. */
export async function sellMembership(page: Page, opts: { planLabel?: RegExp; receivedNow?: string; method?: 'cash' | 'upi' | 'bank' | 'card' } = {}) {
  await page.getByRole('button', { name: /Sell membership|Renew/ }).click()
  const dialog = page.getByRole('dialog')
  if (opts.planLabel) await dialog.getByLabel('Plan').selectOption({ label: await optionLabel(dialog, opts.planLabel) })
  if (opts.receivedNow) await dialog.getByLabel('Received now').fill(opts.receivedNow)
  if (opts.method) await dialog.getByLabel('Payment method').selectOption(opts.method)
  await dialog.getByRole('button', { name: /Sell and create invoice|Renew and create invoice/ }).click()
  await expect(page).toHaveURL(/\/invoices\/inv_/)
  return page.url()
}

async function optionLabel(scope: ReturnType<Page['getByRole']>, re: RegExp): Promise<string> {
  const labels = await scope.getByLabel('Plan').locator('option').allTextContents()
  const hit = labels.find((l) => re.test(l))
  if (!hit) throw new Error(`No plan option matching ${re}: ${labels.join(' | ')}`)
  return hit
}

/** Read every row of a store straight from IndexedDB, bypassing the UI. */
export async function readStore<T = unknown>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    (s) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('gymbook')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const req = db.transaction(s).objectStore(s).getAll()
          req.onsuccess = () => {
            db.close()
            resolve(req.result as T[])
          }
          req.onerror = () => reject(req.error)
        }
      }),
    store,
  )
}

export const inr = (paise: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(paise / 100)
