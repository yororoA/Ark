import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'
import { mockAtlas, record } from './fixtures/voyage-atlas.mjs'

// Browser fixtures only replace public reads. No login or content mutation.
// TEST_BASE_URL=http://127.0.0.1:9999 OFFSET_HOME_EVIDENCE_DIR=docs/tests/offset-home-layout/final node --test tests/offset-home-layout.test.mjs
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const evidence = process.env.OFFSET_HOME_EVIDENCE_DIR
const realDataPath = process.env.OFFSET_HOME_REAL_DATA
let browser, realArticles
before(async () => {
  assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname), 'Use a loopback preview')
  browser = await chromium.launch({ headless: true })
  if (evidence) await mkdir(evidence, { recursive: true })
  if (realDataPath) realArticles = JSON.parse(await readFile(realDataPath, 'utf8')).data.slice(0, 4)
})
after(async () => { await browser?.close() })

const ordinaryTitles = ['Software Requirements 软件需求', 'Agile Software Development 敏捷软件开发', 'Software Process', 'What Makes Good Software?']
function entries({ count = 4, cover = true, long = false, short = false, tall = '', extreme = false } = {}) {
  return ordinaryTitles.slice(0, count).map((title, index) => record(String(index + 1),
    long || (tall === 'featured' ? index === 0 : tall === 'notes' && index > 0)
      ? `${title}${'：在不断变化的软件需求中，重新理解人与工具、设计与实现之间的关系'.repeat(extreme && index === 0 ? 5 : 1)}`
      : short ? `记录 ${index + 1}` : title,
    `2026-11-${20 - index}T12:00:00Z`,
    `${index === 0 && cover ? `![Archive specimen](${baseURL}/404.jpeg)\n\n` : ''}${short ? '一段短记。' : 'Software requirements describe the functions and constraints a system must satisfy. 记录设计取舍与实现细节，让每一段文字都能被完整发现。'.repeat(3)}`,
  ))
}

async function visit(t, width, articles, mode) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', colorScheme: mode })
  t.after(() => context.close())
  await context.addInitScript(mode => {
    localStorage.setItem('ark.design.v1', 'offset')
    localStorage.setItem('ark.theme', mode)
    localStorage.setItem('ark.locale', 'zh')
    localStorage.setItem('ark.mascot:v1', 'off')
  }, mode)
  const writes = [], errors = []
  await context.route('**/api/session**', route => route.fulfill({ json: { data: new URL(route.request().url()).searchParams.has('all') ? [] : null } }))
  await context.route('**/api/blog/**', route => {
    const request = route.request()
    if (['GET', 'HEAD'].includes(request.method())) return route.fallback()
    writes.push(`${request.method()} ${new URL(request.url()).pathname}`)
    return route.fulfill({ status: 409, json: { message: 'Read-only layout test' } })
  })
  await context.route('**/api/blog/status/bines', route => route.fulfill({ json: { data: { online: false } } }))
  await context.route('**/api/blog/github/summary', route => route.fulfill({ json: { data: { reposCount: 0, monthCommits: 0, languages: [] } } }))
  const reads = await mockAtlas(context, articles, [])
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(15000)
  await page.goto(`${baseURL}/home`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await expect(page.locator('html')).toHaveAttribute('data-design', 'offset')
  // The page can arrive with SSR data. Reconnect only after hydration registers
  // the SWR listeners; unrelated prefetch requests must not gate layout checks.
  await expect.poll(async () => {
    if (!reads.articles) await page.evaluate(() => { dispatchEvent(new Event('offline')); dispatchEvent(new Event('online')) })
    return reads.articles
  }, { timeout: 15000, intervals: [100, 200, 500] }).toBeGreaterThan(0)
  await page.evaluate(() => document.fonts.ready)
  const section = page.locator('#offset-writings')
  await expect(section.locator('h3')).toHaveText(articles.map(article => article.title))
  await section.scrollIntoViewIfNeeded()
  await page.waitForFunction(() => [...document.querySelectorAll('#offset-writings img')].every(image => image.complete))
  t.after(() => {
    assert.deepEqual(errors, [], 'No uncaught browser errors')
    assert.deepEqual(writes, [], 'Layout tests never write content')
  })
  return { page, section }
}

async function geometry(section) {
  return section.evaluate(section => {
    const rect = element => {
      if (!element) return null
      const box = element.getBoundingClientRect()
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, width: box.width, height: box.height }
    }
    const textRect = element => {
      if (!element) return null
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      let node
      while ((node = walker.nextNode())) if (node.textContent.trim()) {
        const range = document.createRange()
        range.selectNodeContents(node)
        return rect(range)
      }
      return null
    }
    const grid = section.querySelector('[class*="articleGrid"]')
    const featured = grid.querySelector(':scope > a')
    const notes = grid.querySelector('[class*="notes"]')
    const featuredFoot = featured.querySelector('[class*="featuredFoot"]')
    const archiveLink = notes?.querySelector('a[href="/archive"]')
    const gridStyle = getComputedStyle(grid)
    const wordmarkSlot = notes?.querySelector('[class*="wordmarkSlot"]')
    const wordmark = wordmarkSlot?.querySelector('[class*="wordmark"]')
    const decorativeBounds = wordmarkSlot && getComputedStyle(wordmarkSlot).display !== 'none' ? rect(wordmarkSlot) : null
    return {
      viewport: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth,
      grid: rect(grid), featured: rect(featured), notes: notes && getComputedStyle(notes).display !== 'none' ? rect(notes) : null,
      gridContentBottom: grid.getBoundingClientRect().bottom - parseFloat(gridStyle.borderBottomWidth) - parseFloat(gridStyle.paddingBottom),
      featuredFoot: rect(featuredFoot), archiveLink: rect(archiveLink),
      featuredFootText: textRect(featuredFoot), archiveText: textRect(archiveLink),
      excerpt: rect(featured.querySelector('p')),
      unusedFeaturedSpace: featuredFoot ? featuredFoot.getBoundingClientRect().top - featured.querySelector('p').getBoundingClientRect().bottom : null,
      image: rect(featured.querySelector('img')),
      fakeCover: Boolean(featured.querySelector('[class*="emptyCover"]')),
      decorativeBounds,
      decorativeWords: decorativeBounds ? [...wordmark.querySelectorAll(':scope > span')].map(word => {
        const range = document.createRange()
        range.selectNodeContents(word)
        return { text: word.textContent, ...rect(range) }
      }) : [],
      titles: [...section.querySelectorAll('h3')].map(title => {
        const style = getComputedStyle(title)
        return { ...rect(title), clipped: (style.overflowY !== 'visible' && title.scrollHeight > title.clientHeight + 1) || (style.overflowX !== 'visible' && title.scrollWidth > title.clientWidth + 1) }
      }),
      rows: [...(notes?.querySelectorAll('a[href^="/articles/"]') || [])].map(row => ({ ...rect(row), title: rect(row.querySelector('h3')) })),
    }
  })
}

async function verify(t, { width, count = 4, cover = true, long = false, short = false, tall = '', extreme = false, mode = 'light', real = false }) {
  const articles = real ? realArticles : entries({ count, cover, long, short, tall, extreme })
  const { page, section } = await visit(t, width, articles, mode)
  await expect(section.locator('a[href="/archive"]')).toHaveCount(1)
  const g = await geometry(section)
  const name = `${real ? 'real' : `${count}-${cover ? 'cover' : 'text'}-${tall || (long ? 'long' : short ? 'short' : 'regular')}${extreme ? '-extreme' : ''}`}-${width}-${mode}`
  if (evidence) {
    await writeFile(`${evidence}/${name}.json`, JSON.stringify(g, null, 2))
    await section.screenshot({ path: `${evidence}/${name}.png` })
    if (width <= 640 || tall || real) {
      await section.locator('a').last().scrollIntoViewIfNeeded()
      await page.screenshot({ path: `${evidence}/${name}-end.png` })
    }
  }
  assert(g.overflow <= 1, 'No horizontal page overflow')
  assert(g.featuredFoot && g.featuredFoot.height >= 44, 'The featured article has a visible reading action')
  assert(g.excerpt.bottom <= g.featuredFoot.top + 1, 'The complete excerpt stays above the reading action')
  for (const word of g.decorativeWords) {
    const box = g.decorativeBounds
    assert(word.left >= box.left - 1 && word.right <= box.right + 1 && word.top >= box.top - 1 && word.bottom <= box.bottom + 1,
      `Decorative word ${word.text} escapes its slot: ${JSON.stringify({ word, box })}`)
  }
  for (const title of g.titles) assert(!title.clipped && title.left >= -1 && title.right <= width + 1, 'Titles remain complete inside the viewport')
  if (!cover && !real) assert(!g.image && !g.fakeCover, 'Text-only articles use real text, without a fabricated cover')
  if (articles.length === 1) {
    assert(!g.notes || g.notes.width === 0, 'A single article has no empty companion column')
    assert(Math.abs(g.featured.width - g.grid.width) < 1, 'A single article uses the full section width')
  } else {
    assert(g.unusedFeaturedSpace <= 64, `Unused space above the featured action is ${g.unusedFeaturedSpace}px`)
    assert.equal(g.rows.length, articles.length - 1)
    for (const row of g.rows) assert(row.height >= 44 && row.title.top >= row.top && row.title.bottom <= row.bottom + 1, 'Recent rows have intact titles and touch targets')
    if (g.notes.left >= g.featured.right - 1) {
      assert(Math.abs(g.featuredFoot.bottom - g.archiveLink.bottom) < 1, `Action bottoms differ by ${g.featuredFoot.bottom - g.archiveLink.bottom}px`)
      assert(Math.abs(g.featuredFootText.bottom - g.archiveText.bottom) < 2, 'Both action labels share a visual baseline')
      assert(Math.abs(g.featuredFoot.bottom - g.gridContentBottom) < 1, 'The visible featured footer reaches the section bottom inside its border')
    } else assert(g.notes.top >= g.featured.bottom - 1, 'Stacked compositions follow the featured article without overlap')
  }
  return g
}

for (const width of [1440, 1024, 1001, 1000, 900, 768, 760, 390, 320]) {
  test(`Offset selected articles align visible actions at ${width}px`, t => verify(t, { width }))
}
for (const width of [1440, 900, 390, 320]) {
  test(`Offset long text-only articles keep all titles at ${width}px`, t => verify(t, { width, cover: false, long: true }))
  test(`Offset a single text article fills the section at ${width}px`, t => verify(t, { width, count: 1, cover: false, short: true }))
}
for (const width of [1440, 900, 390]) {
  test(`Offset two short articles have no detached footer at ${width}px`, t => verify(t, { width, count: 2, short: true }))
  test(`Offset a single cover article fills the section at ${width}px`, t => verify(t, { width, count: 1 }))
}
for (const width of [1440, 390]) {
  test(`Offset dark mode retains section geometry at ${width}px`, t => verify(t, { width, mode: 'dark' }))
}
for (const width of [1440, 1024, 1001, 1000, 900, 390]) for (const tall of ['featured', 'notes']) {
  test(`Offset unequal ${tall} title lengths compose naturally at ${width}px`, t => verify(t, { width, tall }))
}
for (const width of [1440, 900]) {
  test(`Offset four short articles keep balanced density at ${width}px`, t => verify(t, { width, short: true }))
}
for (const width of [1024, 1001, 900, 768]) {
  test(`Offset tall featured article and one recent article keep decorative type intact at ${width}px`, t => verify(t, { width, count: 2, tall: 'featured', extreme: true }))
}
test('Offset decorative type changes direction with content height at the same 1024px width', async t => {
  const shorter = await verify(t, { width: 1024, tall: 'notes' })
  const taller = await verify(t, { width: 1024, count: 2, tall: 'featured', extreme: true })
  assert(shorter.decorativeBounds.height < taller.decorativeBounds.height, 'Content produces genuinely different available heights')
  assert(Math.abs(shorter.decorativeWords[0].top - shorter.decorativeWords[1].top) < 1, 'The compact composition keeps its decorative words on one line')
  assert(taller.decorativeWords[1].top > taller.decorativeWords[0].top + 10, 'The tall composition uses stacked decorative words')
})
for (const width of [1440, 390, 320]) {
  test(`Offset empty articles retain an archive destination at ${width}px`, async t => {
    const { page, section } = await visit(t, width, [], 'light')
    await expect(section.locator('[class*="articleGrid"]')).toHaveCount(0)
    await expect(section.locator('a[href="/archive"]')).toBeVisible()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
    if (evidence) await section.screenshot({ path: `${evidence}/empty-${width}-light.png` })
  })
}
for (const width of [1440, 900, 390, 320]) {
  test(`Offset public article snapshot remains aligned at ${width}px`, { skip: !realDataPath }, t => verify(t, { width, real: true }))
}
