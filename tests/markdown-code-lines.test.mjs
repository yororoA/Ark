import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium, expect } from '@playwright/test'
import issue23Repair from '../scripts/repair-issue-23-code-lines.cjs'

// Run only against the isolated verify-blog preview. The article below is
// supplied to this browser context; no saved article or view count is changed.
const baseURL = process.env.TEST_BASE_URL || 'http://127.0.0.1:10730'
const shots = process.env.CODE_SCREENSHOT_DIR
const id = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const code = [
  'existing = [(14, 16)]\nassert has_conflict(existing, (15, 17)) is True\n',
  'def has_conflict(bookings, new):\n    for b in bookings:\n        if new[0] < b[1] and b[0] < new[1]:\n            return True\n\n    return False\n',
  'printf("%s\\n", name);\n\n\t' + 'long_code_segment_'.repeat(32) + '\n',
]
const markdown = ['## RED — Write a Failing Test', '```python\n' + code[0] + '```',
  '## GREEN — Make the Test Pass', '```python\n' + code[1] + '```',
  'A literal escape in inline code: `printf("%s\\n", name)`.', '```c\n' + code[2] + '```'].join('\n\n')
let browser

before(async () => {
  assert(['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname), 'Use an isolated local preview')
  browser = await chromium.launch({ headless: true })
  if (shots) await mkdir(shots, { recursive: true })
})
after(async () => { await browser?.close() })

async function session(t, { design, width = 320, mode = 'light', lineEnding = '\n', content = markdown }) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: mode, reducedMotion: 'reduce' })
  t.after(() => context.close())
  await context.addInitScript(({ design, mode }) => {
    for (const [key, value] of Object.entries({ 'ark.design.v1': design, 'ark.theme': mode, 'ark.locale': 'en', 'ark.mascot:v1': 'off' })) localStorage.setItem(key, value)
    window.__copiedCode = []
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => window.__copiedCode.push(value) } })
  }, { design, mode })
  await context.route(`**/api/blog/knowledge/${id}`, route => route.fulfill({ json: { data: {
    _id: id, title: 'Markdown code line regression', content: content.replaceAll('\n', lineEnding),
    createdAt: '2026-11-19T00:00:00Z', uid: 'fixture-author', username: 'Fixture author', category: 'Development', tags: [],
  } } }))
  await context.route('**/api/blog/knowledge/view', route => route.fulfill({ json: { data: { views: 1 } } }))
  const page = await context.newPage(), errors = []
  page.on('pageerror', error => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, [], 'No browser errors while rendering code'))
  page.setDefaultTimeout(15000)
  page.setDefaultNavigationTimeout(60000)
  await page.goto(`${baseURL}/articles/${id}`, { waitUntil: 'networkidle' })
  const refreshed = page.waitForResponse(response => response.url().endsWith(`/api/blog/knowledge/${id}`))
  await page.evaluate(() => dispatchEvent(new Event('online')))
  await refreshed
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Markdown code line regression')
  await page.evaluate(() => document.fonts.ready)
  return { page, prose: page.locator('[data-voyage-prose]') }
}

async function lineLayout(codeElement) {
  return codeElement.evaluate(element => {
    const text = element.textContent
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    const nodes = []
    for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node)
    const point = offset => {
      for (const node of nodes) {
        if (offset < node.textContent.length) return [node, offset]
        offset -= node.textContent.length
      }
      throw new Error('The source character is missing from the rendered code')
    }
    let offset = 0
    const lines = text.split('\n').flatMap((line, index) => {
      const start = offset
      offset += line.length + 1
      if (!line.trim()) return []
      const first = line.search(/\S/), range = document.createRange()
      range.setStart(...point(start + first)); range.setEnd(...point(start + first + 1))
      const bounds = range.getBoundingClientRect()
      return [{ line: index, top: bounds.top, left: bounds.left }]
    })
    return { lines, lineHeight: Number.parseFloat(getComputedStyle(element.parentElement).lineHeight) }
  })
}

for (const design of ['archive', 'rain', 'p3r', 'prism', 'allotype', 'fold', 'voyage', 'offset']) {
  test(`Markdown code preserves CR source lines, empty lines and indentation in ${design} at 320px`, async t => {
    const { page, prose } = await session(t, { design, lineEnding: '\r' })
    const blocks = prose.locator('pre > code')
    await expect(blocks).toHaveCount(code.length)
    for (let index = 0; index < code.length; index++) {
      assert.equal(await blocks.nth(index).textContent(), code[index], 'Rendering preserves the exact source, including literal escapes')
      const { lines, lineHeight } = await lineLayout(blocks.nth(index))
      for (let line = 1; line < lines.length; line++) {
        const previous = lines[line - 1], current = lines[line]
        assert(Math.abs(current.top - previous.top - (current.line - previous.line) * lineHeight) < 1,
          'Each source newline occupies a real visual row, including blank lines')
      }
      if (index === 1) assert(lines[0].left < lines[1].left && lines[1].left < lines[2].left && lines[2].left < lines[3].left, 'Nested Python indentation remains visible')
    }
    const wide = prose.locator('pre').last()
    assert(await wide.evaluate(element => element.scrollWidth > element.clientWidth + 100), 'A long source line scrolls inside its own code block')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Long code never widens the page')
    assert.equal(await prose.locator('p code').textContent(), 'printf("%s\\n", name)', 'Inline escapes remain literal')
    if (design === 'voyage') {
      await prose.getByRole('button', { name: 'Copy code', exact: true }).last().click()
      assert.deepEqual(await page.evaluate(() => window.__copiedCode), [code[2]], 'Copy preserves blank lines, tabs and literal backslash escapes')
    }
  })
}

for (const lineEnding of ['\n', '\r\n', '\r']) test(`P3R code normalizes ${JSON.stringify(lineEnding)} source line endings at desktop width`, async t => {
  const { prose } = await session(t, { design: 'p3r', width: 1307, mode: 'dark', lineEnding })
  const block = prose.locator('pre > code').first()
  if (shots && lineEnding === '\r') await prose.screenshot({ path: `${shots}/p3r-cr-code.png` })
  const statementRows = await block.evaluate(element => ['existing', 'assert'].map(statement => {
    const start = element.textContent.indexOf(statement), range = document.createRange()
    range.setStart(element.firstChild, start); range.setEnd(element.firstChild, start + statement.length)
    return range.getBoundingClientRect().top
  }))
  assert(statementRows[1] > statementRows[0] + 10, 'The assert statement must appear on a new visual row')
  assert.equal(await block.textContent(), code[0])
  const { lines, lineHeight } = await lineLayout(block)
  assert(Math.abs(lines[1].top - lines[0].top - lineHeight) < 1, 'The two statements occupy separate visual lines')
})

test('The reviewed issue 23 source repair restores its three blocks without renderer guessing', async t => {
  const { REPAIRS } = issue23Repair
  for (const version of ['before', 'after']) {
    const content = ['## 11.4 TDD Example: Reservation Conflict Checking', ...REPAIRS.map(item => item[version])].join('\n\n')
    const { prose } = await session(t, { design: 'p3r', width: 1307, content })
    const blocks = prose.locator('pre > code')
    await expect(blocks).toHaveCount(3)
    for (let index = 0; index < 3; index++) {
      const expected = REPAIRS[index][version].slice(4, -3)
      assert.equal(await blocks.nth(index).textContent(), expected)
      const { lines, lineHeight } = await lineLayout(blocks.nth(index))
      if (version === 'before') assert.equal(lines.length, 1, 'A flattened saved source is rendered faithfully, without inferred Python edits')
      else {
        assert(lines.length >= 2)
        for (let line = 1; line < lines.length; line++) assert(Math.abs(lines[line].top - lines[line - 1].top - (lines[line].line - lines[line - 1].line) * lineHeight) < 1)
      }
    }
    if (shots) await prose.screenshot({ path: `${shots}/issue-23-source-${version}.png` })
  }
})
