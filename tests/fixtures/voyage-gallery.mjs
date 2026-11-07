// Read-only media fixtures. All images come from this repository; the small
// playable video is drawn locally so gallery checks never depend on a CDN.
export const longDescription = 'After the rain, the lights along the river appeared one by one. We stayed a little longer to remember the quiet water, the last train, and the road home. '

export function galleryFiles(baseURL, { long = false, broken = false } = {}) {
  const image = (name, path, desc, createdAt) => ({ filename: `${name}.png`, url: `${baseURL}/${path}?contact-frame=${name}`, mime: 'image/png', desc, username: 'Fixture photographer', ...(createdAt ? { createdAt } : {}) })
  return [
    image('october', 'bg.jpg', long ? longDescription.repeat(3) : 'The final evening of October', '2026-10-31T15:45:00Z'),
    image('undated', 'login_light.png', 'An image without a recorded date'),
    image('latest', broken ? 'contact-sheet-missing.png' : '404.jpeg', 'A quiet evening by the window', '2026-11-06T12:00:00Z'),
    { filename: 'local-motion.webm', url: `${baseURL}/contact-sheet-fixture.webm`, mime: 'video/webm', desc: 'A moving line recorded in October', username: 'Fixture photographer', createdAt: '2026-10-30T12:00:00Z' },
    image('boundary', 'login_dark.png', 'Just after midnight on the first of November', '2026-10-31T23:30:00Z'),
    image('invalid', 'themes/voyage/ocean-engraving.webp', 'A photograph with an unavailable date', 'not-a-recorded-date'),
  ]
}

export async function createLocalVideo(browser) {
  const page = await browser.newPage()
  try {
    return Buffer.from(await page.evaluate(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 160; canvas.height = 90
      const drawing = canvas.getContext('2d'), stream = canvas.captureStream(10)
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' }), chunks = []
      recorder.ondataavailable = event => chunks.push(event.data)
      const stopped = new Promise(resolve => { recorder.onstop = resolve })
      recorder.start()
      for (let frame = 0; frame < 4; frame++) {
        drawing.fillStyle = '#080f26'; drawing.fillRect(0, 0, 160, 90)
        drawing.fillStyle = '#e6ff62'; drawing.fillRect(frame * 25, 43, 30, 3)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      recorder.stop(); await stopped
      stream.getTracks().forEach(track => track.stop())
      const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer())
      return btoa(String.fromCharCode(...bytes))
    }), 'base64')
  } finally { await page.close() }
}

export async function mockGallery(context, files, video) {
  const reads = { gallery: 0 }
  await context.route('**/api/blog/gallery/get?*', route => {
    reads.gallery++
    return route.fulfill({ json: { data: { files, count: files.length, hasMore: false, breakpoint: null } } })
  })
  await context.route('**/contact-sheet-fixture.webm', route => route.fulfill({ body: video, contentType: 'video/webm' }))
  await context.route('**/contact-sheet-missing.png?*', route => route.fulfill({ status: 404, body: 'Missing fixture image' }))
  return reads
}

export async function showGallery(page, baseURL) {
  await page.goto(`${baseURL}/gallery`, { waitUntil: 'networkidle' })
  await page.evaluate(() => { dispatchEvent(new Event('online')); return document.fonts.ready })
}
