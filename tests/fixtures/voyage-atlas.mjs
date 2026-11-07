// Browser-only replacements for the homepage's existing two read contracts.
export function record(id, title, date, content = 'A real record in the reading route.') {
  return { _id: id.padStart(24, '0'), title, content, createdAt: date, category: 'Journal', tags: [], uid: 'fixture-author', username: 'Fixture author' }
}
export const routeArticles = [
  record('1', 'The most recent page', '2026-11-06T12:00:00Z'),
  record('3', 'A page from yesterday', '2026-11-04T12:00:00Z'),
]
export const routeMoments = [
  record('2', 'An evening observation', '2026-11-05T12:00:00Z'),
  record('4', 'An earlier moment', '2026-11-03T12:00:00Z'),
]
export async function mockAtlas(context, articles = routeArticles, moments = routeMoments) {
  const reads = { articles: 0, moments: 0 }
  await context.route('**/api/blog/knowledge?limit=4', route => { reads.articles++; return route.fulfill({ json: { success: true, data: articles } }) })
  await context.route('**/api/blog/moments/summary?*', route => { reads.moments++; return route.fulfill({ json: { success: true, data: { entries: moments, activeDates: [] } } }) })
  return reads
}
export async function showAtlas(page, baseURL) {
  await page.goto(`${baseURL}/home`, { waitUntil: 'networkidle' })
  await page.evaluate(() => { dispatchEvent(new Event('online')); return document.fonts.ready })
}
