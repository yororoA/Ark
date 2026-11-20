import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'
import { mockAtlas, record, showAtlas } from './fixtures/voyage-atlas.mjs'

const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const evidence = process.env.HOME_PREVIEW_EVIDENCE_DIR
let browser
before(async () => { browser = await chromium.launch({ headless: true }); if (evidence) await mkdir(evidence, { recursive: true }) })
after(async () => { await browser?.close() })

const titles = ['Agile Software Development 敏捷软件开发', 'Software Process', 'What Makes Good Software?', '最近做的一个清理 .DS_Store 的 macOS 应用：Bye.DS_Store']
const articles = titles.map((title, index) => record(String(index + 1), title, `2026-11-${String(19 - index).padStart(2, '0')}T12:00:00Z`, `${index === 0 ? `![Archive specimen](${baseURL}/404.jpeg)\n\n` : ''}在软件开发过程中，团队经常会遇到需求变化。记录实现细节与设计取舍，让每一段文字都能够被完整发现。`))
const moments = Array.from({ length: 8 }, (_, index) => record(String(index + 11), `片刻 ${index + 1}：沿着河边慢慢走回家`, `2026-10-${String(20 - index).padStart(2, '0')}T12:00:00Z`))

async function session(t, design, width, count = 4) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
  t.after(() => context.close())
  await context.addInitScript(design => {
    localStorage.setItem('ark.design.v1', design)
    localStorage.setItem('ark.theme', 'light')
    localStorage.setItem('ark.locale', 'zh')
    localStorage.setItem('ark.mascot:v1', 'off')
  }, design)
  const reads = await mockAtlas(context, articles.slice(0, count), moments)
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, []))
  await showAtlas(page, baseURL)
  await expect.poll(() => reads.articles > 0 && reads.moments > 0).toBe(true)
  await expect(page.locator('html')).toHaveAttribute('data-design', design)
  return page
}

async function capture(page, locator, name, measurements) {
  if (!evidence) return
  if (page.viewportSize().width <= 640) {
    await page.screenshot({ path: `${evidence}/${name}.png` })
    await locator.locator('a').last().scrollIntoViewIfNeeded()
    await page.screenshot({ path: `${evidence}/${name}-end.png` })
  } else await locator.screenshot({ path: `${evidence}/${name}.png` })
  await writeFile(`${evidence}/${name}.json`, JSON.stringify(measurements, null, 2))
}

async function showSection(locator) {
  await locator.evaluate(element => window.scrollTo({ top: Math.max(0, scrollY + element.getBoundingClientRect().top - 100), behavior: 'instant' }))
}

for (const width of [1440, 900, 390, 320]) {
  test(`Voyage directory exposes every recent article and moment at ${width}px`, async t => {
    const page = await session(t, 'voyage', width)
    const directory = page.locator('#voyage-logbook')
    await showSection(directory)
    const links = directory.locator('[data-record-key]')
    const keys = await links.evaluateAll(nodes => nodes.map(node => node.dataset.recordKey))
    await capture(page, directory, `voyage-${width}`, { keys })
    assert.equal(keys.length, 12, 'The four route previews must not remove articles from the full directory')
    assert.equal(new Set(keys).size, 12, 'Each record appears only once within the directory')
    for (const [kind, entries] of [['articles', articles], ['moments', moments]]) for (const entry of entries) {
      const link = directory.locator(`a[href="/${kind}/${entry._id}"]`)
      await expect(link).toHaveCount(1)
      await expect(link.getByRole('heading')).toHaveText(entry.title)
      const box = await link.boundingBox()
      assert(box && box.height >= 44 && box.x >= 0 && box.x + box.width <= width + 1)
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await expect(page.getByRole('tab')).toHaveCount(4)
  })
}

for (const width of [1440, 900, 390]) for (const count of [1, 2, 4]) {
  test(`P3R featured article and ${count - 1} recent rows align without clipping at ${width}px`, async t => {
    const page = await session(t, 'p3r', width, count)
    const recent = page.locator('#recent')
    await showSection(recent)
    const geometry = await recent.evaluate(element => {
      const featured = element.querySelector('[class*="featured-entry"]').getBoundingClientRect()
      const grid = element.querySelector('[class*="recent-grid"]').getBoundingClientRect()
      const rows = [...element.querySelectorAll('[class*="entry-row"]')].map(row => {
        const bounds = row.getBoundingClientRect(), title = row.querySelector('h3').getBoundingClientRect()
        return { top: bounds.top, bottom: bounds.bottom, height: bounds.height, titleTop: title.top, titleBottom: title.bottom, left: bounds.left, right: bounds.right }
      })
      return { featured: { top: featured.top, bottom: featured.bottom, width: featured.width }, gridWidth: grid.width, rows, overflow: document.documentElement.scrollWidth > innerWidth }
    })
    await capture(page, recent, `p3r-${width}-${count}`, geometry)
    assert.equal(geometry.rows.length, count - 1)
    assert.equal(geometry.overflow, false)
    for (const row of geometry.rows) assert(row.height >= 44 && row.titleTop >= row.top && row.titleBottom <= row.bottom && row.left >= 0 && row.right <= width + 1, 'Full row titles and hit targets stay inside the viewport')
    if (count === 1) assert(Math.abs(geometry.featured.width - geometry.gridWidth) < 1, 'A single article leaves no empty companion column')
    else if (width > 700) {
      assert(Math.abs(geometry.featured.top - geometry.rows[0].top) < 1, 'Both columns start together')
      assert(Math.abs(geometry.featured.bottom - geometry.rows.at(-1).bottom) < 1, 'The last list row aligns with the featured card bottom')
    } else assert(geometry.rows[0].top >= geometry.featured.bottom, 'Mobile rows follow the featured article naturally')
  })
}
