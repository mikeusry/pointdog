/**
 * Design review screenshot tool — Drain + Tree.
 *
 * Captures full-page screenshots of the local dev site at multiple viewports
 * for design QA + AI-assisted iteration.
 *
 * Usage:
 *   npm run dev          # in another shell, http://localhost:4321
 *   node scripts/screenshots.mjs
 *
 * Output:
 *   screenshots/{name}-{viewport}.png (gitignored)
 */

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = process.env.BASE_URL || 'http://localhost:4321'
const OUT = resolve(__dirname, '../screenshots')

mkdirSync(OUT, { recursive: true })

const pages = [
  { name: '01-home', path: '/' },
  { name: '02-about', path: '/about' },
  { name: '03-contact', path: '/contact' },
  { name: '04-grading', path: '/grading' },
  { name: '05-grading-driveway', path: '/grading/driveway-installation-and-repair' },
  { name: '06-grading-gravel', path: '/grading/gravel-installation-services' },
  { name: '07-drainage', path: '/drainage' },
  { name: '08-drainage-french', path: '/drainage/french-drains' },
  { name: '09-drainage-pond', path: '/drainage/retention-pond-maintenance' },
  { name: '10-tree-service', path: '/tree-service' },
  { name: '11-landscapes', path: '/landscapes' },
  { name: '12-projects', path: '/projects' },
  { name: '13-project-detail', path: '/projects/industrial-tank-burial' },
  { name: '14-team', path: '/team' },
  { name: '15-team-detail', path: '/team/mike-usry' },
  { name: '16-blog', path: '/blog' },
  { name: '17-article', path: '/article/how-much-does-it-cost-to-take-down-a-tree' },
  { name: '18-jobs', path: '/jobs' },
]

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 375, height: 812 },
]

const browser = await chromium.launch()
let ok = 0
let fail = 0

for (const p of pages) {
  for (const vp of viewports) {
    const filename = `${p.name}-${vp.name}.png`
    try {
      const page = await browser.newPage({
        viewport: { width: vp.width, height: vp.height },
      })
      await page.goto(`${BASE}${p.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      })
      await page.waitForTimeout(2000)
      await page.screenshot({ path: `${OUT}/${filename}`, fullPage: true })
      console.log(`  ${filename}`)
      ok++
      await page.close()
    } catch (e) {
      console.log(`  FAIL ${filename} - ${e.message.split('\n')[0]}`)
      fail++
    }
  }
}

await browser.close()
console.log(`\n${ok} captured, ${fail} failed -> ${OUT}`)
