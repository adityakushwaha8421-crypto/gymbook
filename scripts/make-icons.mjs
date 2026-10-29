import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
const svg = readFileSync('public/logo.svg', 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 })
for (const size of [192, 512]) {
  // Full-bleed background for maskable icons; the mark sits inside the 80% safe zone.
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:#c81e2e;display:grid;place-items:center;width:${size}px;height:${size}px">
    <div style="width:${Math.round(size * 0.78)}px;height:${Math.round(size * 0.78)}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`)
  await page.evaluate(() => document.fonts.ready)
  writeFileSync(`public/icon-${size}.png`, await page.screenshot({ type: 'png' }))
}
await browser.close()
console.log('icons written')
