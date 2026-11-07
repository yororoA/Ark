import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'

// Run against the isolated verify-blog preview. Browser responses replace only
// this test context's article after SWR reconnects; no backend writes are used.
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10000'
const artifacts = process.env.PROSE_ARTIFACTS
const id = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const english = 'The coast is quiet at this hour. We keep a record of ordinary details: a window lit across the water, the shape of a sentence, a page turned before dawn. A reader should be able to pause here and return without losing the place. The same experience should remain comfortable when the story crosses from a phone to a large desktop monitor. The rhythm of a paragraph comes from its line length as much as its typeface, and an overlong line can turn a quiet story into a scanning exercise. There is no need to make the type larger simply to fill an available column; the page can leave some room for the reader.'
const content = [
  '## Reading measure', english,
  '正常中文段落和英文应该使用合理的行长。行内代码 `cache.readingRoute.activeWaypointWithAPersistentIdentifierAndSeveralNestedPropertiesAcrossManyLevels` 应当留在窄屏里。',
  `[https://example.com/${'continuousReadingReference'.repeat(8)}](https://example.com/reference)`,
  '> 引用内容应该自然换行，保留清晰的边界。\n>\n> A quotation has a comfortable measure of its own.',
  '14. 一个包含长解释的列表项，应该保留真实编号和正常缩进。\n15. 下一项\n    - 子项，包含 `navigation.checkpoint`。',
  '## Wide table',
  '| 记录日期 | 观察内容 | 信号类型 | 参考标识 | 状态说明 |\n| --- | --- | --- | --- | --- |\n| 2026-11-06 | 长时间阅读之后再回到当前段落，检查记录是否完整保存。 | Reading checkpoint | 123e4567-e89b-12d3-a456-426614174000 | 等待重新校准当前位置 |\n| 2026-11-05 | 这一条包含英文和数字，A quiet place beyond the familiar shore。 | Navigation event | route.reader.current.position | 已完成，允许继续阅读 |',
  '## Full-width media',
  '```js\nconst readingRoute = "A deliberately long code line that should keep the full prose width independently of the paragraph reading measure."\n```',
  `![Landscape chart](${baseURL}/prose-landscape.svg)`,
  `![Portrait chart](${baseURL}/prose-portrait.svg)`,
].join('\n\n')
let browser
before(async () => {
  browser = await chromium.launch({ headless: true })
  if (artifacts) await mkdir(artifacts, { recursive: true })
})
after(async () => { await browser?.close() })

async function session(t, width, mode, design = 'voyage') {
  const context = await browser.newContext({ viewport: { width, height: width < 1000 ? 844 : 1000 }, reducedMotion: 'reduce', colorScheme: mode })
  t.after(() => context.close())
  await context.addInitScript(({ mode, design }) => {
    for (const [key, value] of Object.entries({ 'ark.design.v1': design, 'ark.theme': mode, 'ark.locale': 'zh', 'ark.mascot:v1': 'off' })) localStorage.setItem(key, value)
  }, { mode, design })
  await context.route(`**/api/blog/knowledge/${id}`, route => route.fulfill({ json: { data: {
    _id: id, title: 'Prose measure fixture', content, createdAt: '2026-11-06T00:00:00Z', uid: 'fixture-author', username: 'Fixture author', category: 'Reading', tags: [],
  } } }))
  for (const [name, width, height] of [['landscape', 1200, 650], ['portrait', 720, 1200]]) {
    await context.route(`**/prose-${name}.svg`, route => route.fulfill({ contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#203447"/><rect x="4" y="4" width="${width - 8}" height="${height - 8}" fill="none" stroke="#e6ff62" stroke-width="8"/></svg>` }))
  }
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, []))
  page.setDefaultTimeout(12000)
  await page.goto(`${baseURL}/articles/${id}`, { waitUntil: 'networkidle' })
  const refreshed = page.waitForResponse(response => response.url().endsWith(`/api/blog/knowledge/${id}`))
  await page.evaluate(() => dispatchEvent(new Event('online')))
  await refreshed
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Prose measure fixture')
  await page.evaluate(() => document.fonts.ready)
  return { page, context, prose: page.locator('[data-voyage-prose]') }
}

test('Voyage prose keeps readable columns, keyboard-scrolling tables and full-width media', async t => {
  for (const width of [320, 390, 1440]) for (const mode of ['light', 'dark']) {
    const { page, context, prose } = await session(t, width, mode)
    const layout = await prose.evaluate(element => {
      const table = element.querySelector('table'), paragraph = element.querySelector('p')
      const pictures = [...element.querySelectorAll('p:has(img)')]
      const code = element.querySelector('[data-voyage-code]') || element.querySelector('pre')
      return {
        prose: element.getBoundingClientRect().width, paragraph: paragraph.getBoundingClientRect().width,
        table: table.clientWidth, scrollWidth: table.scrollWidth, rowHeights: [...table.rows].map(row => row.getBoundingClientRect().height),
        images: pictures.map(picture => picture.getBoundingClientRect().width), code: code.getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }
    })
    assert.equal(layout.overflow, false, `${width}px ${mode}: the page does not overflow`)
    assert(Math.max(...layout.rowHeights) < 160, 'Table cells keep words together instead of becoming vertical text strips')
    assert(Math.abs(layout.table - layout.prose) <= 1 && Math.abs(layout.code - layout.prose) <= 1)
    assert(layout.images.every(value => Math.abs(value - layout.prose) <= 1), 'Image paragraphs remain as wide as the prose container')
    if (width === 1440) assert(layout.paragraph >= 600 && layout.paragraph <= 700 && layout.paragraph < layout.prose * .85)
    const table = prose.locator('table')
    await expect(table).toHaveAttribute('tabindex', '0')
    if (width < 1000) {
      assert(layout.scrollWidth > layout.table + 300, 'Wide content remains available in a horizontal scroll area')
      await table.focus()
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
      for (let step = 0; step < 60; step++) {
        if (await table.evaluate(element => element.scrollLeft >= element.scrollWidth - element.clientWidth - 1)) break
        await page.keyboard.press('ArrowRight')
        await page.waitForTimeout(25)
      }
      await expect.poll(() => table.evaluate(element => {
        const last = element.rows[0].cells[element.rows[0].cells.length - 1].getBoundingClientRect()
        return last.right <= element.getBoundingClientRect().right + 1
      })).toBe(true)
      if (artifacts) await page.screenshot({ path: `${artifacts}/table-keyboard-end-${width}-${mode}.png` })
    }
    await context.close()
  }
})

test('Other themes keep their prose layout while native tables become keyboard-focusable', async t => {
  for (const design of ['archive', 'rain', 'p3r', 'prism', 'allotype', 'fold']) {
    const { context, prose } = await session(t, 1440, 'light', design)
    const styles = await prose.evaluate(element => ({
      paragraphMax: getComputedStyle(element.querySelector('p')).maxInlineSize,
      cellMin: getComputedStyle(element.querySelector('td')).minInlineSize,
      tabIndex: element.querySelector('table').tabIndex,
    }))
    assert.equal(styles.paragraphMax, 'none', `${design}: Voyage's paragraph measure is isolated`)
    assert.notEqual(styles.cellMin, '144px', `${design}: Voyage's table column width is isolated`)
    assert.equal(styles.tabIndex, 0)
    await context.close()
  }
})
