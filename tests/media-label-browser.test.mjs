import { test } from 'node:test'
import { chromium, expect } from '@playwright/test'
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:10500'
test('the same media has the same preview title in moments and gallery', async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const desc of ['海边的傍晚', '']) {
      const context = await browser.newContext({ reducedMotion: 'reduce' })
      await context.addInitScript(() => { localStorage.setItem('ark.design.v1', 'voyage'); localStorage.setItem('ark.locale', 'zh'); localStorage.setItem('ark.mascot:v1', 'off') })
      const id = 'bbbbbbbbbbbbbbbbbbbbbbbb', filename = 'stored.png', url = `${base}/404.jpeg`, originalName = '原始图片.png'
      const entry = { _id: id, title: '片刻标题不是图片标题', content: 'Media title regression', uid: 'fixture', createdAt: '2026-11-06T12:00:00Z', comments: [], filenames: { [filename]: url }, filesDetail: { [filename]: { origin: originalName, desc, secure_url: url } } }
      await context.route(`**/api/blog/moments/${id}`, route => route.fulfill({ json: { data: entry } }))
      await context.route('**/api/blog/gallery/get?*', route => route.fulfill({ json: { data: { files: [{ filename, originalName, desc, url, mime: 'image/png' }], count: 1, hasMore: false } } }))
      const page = await context.newPage(), label = desc || originalName
      await page.goto(`${base}/moments/${id}`, { waitUntil: 'networkidle' })
      await page.evaluate(() => dispatchEvent(new Event('online')))
      await page.getByRole('button', { name: label, exact: true }).click()
      await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(label)
      await page.keyboard.press('Escape')
      await page.goto(`${base}/gallery`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: `预览 ${label}`, exact: true }).click()
      await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(label)
      await context.close()
    }
  } finally { await browser.close() }
})
