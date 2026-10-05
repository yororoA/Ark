// Integration verification against an in-memory backend. Never loads .env.
// Node >= 24: node scripts/verify-blog.mjs [--serve]
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { cp, mkdir, symlink, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const work = resolve(root, '.git/ark-research/contract-app')
const origin = 'http://127.0.0.1:10000'
const backend = 'http://127.0.0.1:10001'
const articleId = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const momentId = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const commentId = 'cccccccccccccccccccccccc'
let sequence = 0
const users = new Map()
const calls = []
const controls = { rotateV1: false, rotateV2: false, fail: false }
const article = { _id: articleId, uid: 'test-admin', username: 'Tester', title: 'A small record of time', content: `![Archive specimen](${origin}/404.jpeg)\n\n# A small record\n\nWords, code, and quiet moments.\n\n- Read\n- Create\n- Remember`, category: 'Development', tags: ['Ark'], createdAt: '2026-10-01T12:00:00Z', likes: 2, views: 12 }
const moment = { ...article, _id: momentId, title: 'October, a beginning', comments: [commentId], published: true, filenames: {} }
const articles = [article]
const moments = [moment]
const messages = [
  { _id: 'first-message', uid: 'another-user', username: 'Visitor', text: 'Hello, Ark.', createdAt: '2026-10-01T12:00:00Z' },
  { _id: 'image-message', uid: 'another-user', username: 'A visitor with a deliberately long display name for overflow checks', text: 'Image record', imgurl: [`${origin}/login_light.png`], createdAt: '2026-10-01T12:01:00Z' },
  { _id: 'mixed-message', uid: 'test-admin', username: 'Tester', text: 'Text, video, and image in one message.', imgurl: ['https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', `${origin}/login_dark.png`, `${origin}/logo.png`], createdAt: '2026-10-01T12:02:00Z' },
]
const guestbook = []
const comments = [{ _id: commentId, uid: 'another-user', username: 'Visitor', content: 'A quiet place to return to.', createdAt: article.createdAt }]
const likes = new Set()
let draft = null

function rotate(user) { user.token = `fixture-token-${++sequence}`; return user.token }
function addUser(uid, username, isGuest = false) {
  const user = { uid, username, isGuest, token: '' }
  rotate(user); users.set(uid, user)
  return user
}
function cookieValues(value = '') {
  return Object.fromEntries(value.split(';').filter(Boolean).map(entry => {
    const index = entry.indexOf('=')
    return [entry.slice(0, index).trim(), decodeURIComponent(entry.slice(index + 1))]
  }))
}
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, backend)
    const path = url.pathname
    const buffers = []
    for await (const chunk of req) buffers.push(chunk)
    const buffer = Buffer.concat(buffers)
    let body = {}
    if (buffer.length) {
      if (req.headers['content-type']?.startsWith('multipart/')) {
        const form = await new Request(url, { method: 'POST', headers: req.headers, body: buffer }).formData()
        body = Object.fromEntries(form)
        body.fileCount = [...form.values()].filter(value => typeof value !== 'string').length
      } else body = JSON.parse(buffer)
    }
    calls.push({ path, method: req.method, body, uid: req.headers.uid, query: url.search })
    const json = (data, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)) }
    const ok = (data, extra = {}) => json({ success: true, data, ...extra })
    if (path === '/api/v2/login' || path === '/api/v2/register') {
      if (body.username === 'wrong') return json({ message: 'Wrong password' }, 401)
      if (body.username === 'legacy' && !body.isLegacy) return json({ message: 'Legacy account', hint: 'legacy_user_detected' }, 401)
      if (body.isLegacy && body.password !== 'fixture-password') return json({ message: 'Wrong legacy password' }, 401)
      const user = addUser(body.username === 'tester' ? 'test-admin' : `test-${body.username}`, body.username)
      return json({ message: 'ok', ...user })
    }
    if (path === '/api/v2/guest/login' || path === '/api/guest/login') {
      const user = addUser(`guest-${++sequence}`, 'Guest', true)
      return json({ message: 'ok', data: { ...user, expiresAt: new Date(Date.now() + 1800000).toISOString() } })
    }
    if (path === '/api/v2/verification/send') return json({ status: 'ok' })
    const cookies = cookieValues(req.headers.cookie)
    let user = users.get(req.headers.uid)
    const valid = user && req.headers.authorization === `Bearer ${user.token}`
    if (path === '/api/chat/hasPrivate') {
      if (!valid || url.searchParams.get('userId') !== user.uid) return json({ tokenError: true }, 401)
      if (controls.rotateV1) { controls.rotateV1 = false; res.setHeader('X-Refreshed-Token', rotate(user)) }
      return ok({ hasHistory: false })
    }
    if (path === '/api/v2/auth/me') {
      // Reproduce the legacy backend's unsafe uid recovery, so tests prove
      // that the gateway cannot use this alone as identity verification.
      user = users.get(cookies.blog_active_uid)
      if (!user) return json({ valid: false }, 401)
      if (controls.rotateV2) {
        controls.rotateV2 = false
        res.setHeader('Set-Cookie', `blog_tokens=${encodeURIComponent(`${user.uid}:${rotate(user)},unrelated:do-not-import`)}; HttpOnly; Path=/`)
      }
      return json({ valid: true, uid: user.uid, username: user.username, isGuest: user.isGuest })
    }
    const isPublic = req.method === 'GET' && /\/(?:knowledge|moments\/(?:[a-f0-9]{24}|get|files)|gallery|archive|about|guestbook|status|github)(?:\/|$)/.test(path)
    const publicWrite = path === '/api/guestbook' || path === '/api/knowledge/view' || path === '/api/moments/view'
    if (!isPublic && !publicWrite && !valid) return json({ message: 'Invalid token', tokenError: true }, 401)
    if (valid && user.isGuest && req.method !== 'GET' && !path.startsWith('/api/chat/') && !publicWrite && path !== '/api/moments/comment/get') return json({ message: 'Guests cannot publish' }, 403)
    if (controls.fail && path === '/api/knowledge') return json({ message: 'Fixture service unavailable' }, 503)
    if (path === '/api/sse/subscribe') {
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      const token = rotate(user)
      res.write('event: token\ndata: ')
      res.write(`${JSON.stringify({ data: { token } })}\n\n`)
      res.write(`event: chat\ndata: ${JSON.stringify({ chatType: 'group', data: messages[0] })}\n\n`)
      res.write('event: token\ndata: invalid-json\n\n')
      // Deliberately split CRLF between chunks.
      res.write('event: token\r')
      setImmediate(() => {
        res.write(`\ndata: ${JSON.stringify({ data: { token } })}\r\n\r\n`)
        res.write('event: article\ndata: {"data":{}}\n\n')
      })
      return
    }
    if (path === '/api/knowledge/meta/categories') return ok(['Development', 'Life'])
    if (path.endsWith('/liked')) return ok([...likes])
    if (path.endsWith('/like')) {
      if (body.like) likes.add(body.articleId || body.momentId || body.commentId)
      else likes.clear()
      return ok({ likes: likes.size })
    }
    if (path === '/api/knowledge/upload-image') return ok({ url: `${backend}/fixture.png`, filename: 'fixture.png' })
    if (path === '/api/knowledge/view') return ok({ views: 13 })
    if (path === '/api/knowledge') {
      if (req.method === 'POST') { const item = { ...article, ...body, _id: (++sequence).toString(16).padStart(24, '0'), uid: user.uid }; articles.unshift(item); return ok(item) }
      const filtered = articles.filter(item => (!url.searchParams.get('keyword') || item.title.includes(url.searchParams.get('keyword'))) && (!url.searchParams.get('category') || item.category === url.searchParams.get('category')))
      const page = +(url.searchParams.get('page') || 1), limit = +(url.searchParams.get('limit') || 20)
      return ok(filtered.slice((page - 1) * limit, page * limit), { pagination: { page, limit, total: filtered.length, pages: Math.ceil(filtered.length / limit) } })
    }
    if (/\/knowledge\/[a-f0-9]{24}$/.test(path)) {
      const index = articles.findIndex(item => item._id === path.split('/').pop())
      if (index < 0) return json({ message: 'Not found' }, 404)
      if (req.method === 'PUT') Object.assign(articles[index], body)
      if (req.method === 'DELETE') { articles.splice(index, 1); return ok({ deleted: true }) }
      return ok(articles[index])
    }
    if (path === '/api/moments/get') return ok(url.searchParams.get('isEditing') === 'true' ? draft : moments)
    if (/\/moments\/[a-f0-9]{24}$/.test(path)) {
      const item = moments.find(entry => entry._id === path.split('/').pop())
      return item ? ok(item) : json({ message: 'Not found' }, 404)
    }
    if (path === '/api/moments/post') {
      const item = { ...moment, ...body, uid: user.uid, _id: (++sequence).toString(16).padStart(24, '0'), comments: [] }
      if (body.published === 'false') draft = item
      else { moments.unshift(item); draft = null }
      return ok(item)
    }
    if (path === '/api/moments/delete') { const index = moments.findIndex(item => item._id === body.momentId); if (index >= 0) moments.splice(index, 1); return ok({ deleted: true }) }
    if (path === '/api/moments/files') return ok({})
    if (path === '/api/moments/view') return ok({ views: 13 })
    if (path === '/api/moments/comment/get') return ok(comments.filter(item => body.commentIds?.includes(item._id)))
    if (path === '/api/moments/comment/post') { const comment = { ...comments[0], _id: `${++sequence}`, content: body.comment, belong: body.belong, uid: user.uid }; comments.push(comment); moment.comments.push(comment._id); return ok(comment) }
    if (path === '/api/gallery/get') return ok({ files: [], count: 0, hasMore: false, breakpoint: null })
    if (path === '/api/gallery/post') return ok({ count: body.fileCount, files: ['fixture.png'] })
    if (path === '/api/links') return ok([{ _id: commentId, name: 'Project source', url: 'https://github.com/yororoA', category: 'friend' }])
    if (path.startsWith('/api/admin/links')) { if (user.uid !== 'test-admin') return json({ message: 'Forbidden' }, 403); return ok({ ...body, _id: commentId }) }
    if (path === '/api/about') return ok({ title: 'YororoIce', description: 'A personal chronicle', author: 'YororoIce' })
    if (path === '/api/status/bines') return ok({ online: true })
    if (path === '/api/github/summary') return ok({ reposCount: 8, monthCommits: 21, languages: [{ name: 'TypeScript', percent: 72 }] })
    if (path === '/api/guestbook') { if (req.method === 'POST') guestbook.push({ ...body, _id: `${++sequence}`, createdAt: article.createdAt }); return ok(req.method === 'POST' ? guestbook.at(-1) : guestbook) }
    if (path === '/api/chat/conversations') return ok([
      { id: 'group', type: 'group' },
      { id: 'admin', type: 'private' },
      { id: 'long-private-conversation-id', label: 'A very long private conversation name that must never widen the sidebar', type: 'private' },
    ])
    if (path === '/api/chat/history') return ok(url.searchParams.get('userId') === 'group' ? messages : [], { hasMore: url.searchParams.get('page') === '1' })
    if (path === '/api/chat/upload') return ok({ urls: Array(body.fileCount).fill(`${backend}/fixture.png`) })
    if (path === '/api/chat/send') { const message = { ...body, _id: `${++sequence}`, uid: user.uid, createdAt: new Date().toISOString() }; messages.push(message); return ok(message) }
    return json({ message: `Unimplemented fixture: ${path}` }, 404)
  } catch (error) { res.writeHead(500); res.end(JSON.stringify({ message: error.message })) }
})

await mkdir(work, { recursive: true })
await cp(resolve(root, 'src'), resolve(work, 'src'), { recursive: true })
for (const file of ['package.json', 'tsconfig.json', 'next.config.ts', 'next-env.d.ts', 'postcss.config.mjs']) await cp(resolve(root, file), resolve(work, file))
for (const dir of ['node_modules', 'public']) await symlink(resolve(root, dir), resolve(work, dir)).catch(error => { if (error.code !== 'EEXIST') throw error })
server.listen(10001, '127.0.0.1')
await once(server, 'listening')
let log = ''
const app = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '-H', '127.0.0.1', '-p', '10000'], {
  cwd: work, env: { ...process.env, BACKEND_URL: backend, ADMIN_UIDS: 'test-admin' }, stdio: ['ignore', 'pipe', 'pipe'],
})
const ready = new Promise((resolveReady, reject) => {
  const timeout = setTimeout(() => reject(new Error('Next fixture did not start')), 60000)
  for (const output of [app.stdout, app.stderr]) output.on('data', chunk => {
    log += chunk.toString()
    if (log.includes('Ready in')) { clearTimeout(timeout); resolveReady() }
  })
  app.once('exit', code => { clearTimeout(timeout); reject(new Error(`Next exited ${code}`)) })
})
function stop() { app.kill('SIGTERM'); server.closeAllConnections(); server.close() }
process.on('SIGINT', () => { stop(); process.exit() })
process.on('SIGTERM', () => { stop(); process.exit() })

class Client {
  jar = new Map()
  async request(path, body, method = body === undefined ? 'GET' : 'POST', headers = {}) {
    const multipart = body instanceof FormData
    const response = await fetch(`${origin}${path}`, {
      method, redirect: 'manual',
      headers: { origin, cookie: [...this.jar].map(([name, value]) => `${name}=${value}`).join('; '), ...(body !== undefined && !multipart ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    })
    for (const entry of response.headers.getSetCookie()) {
      const [cookie] = entry.split(';'), index = cookie.indexOf('=')
      this.jar.set(cookie.slice(0, index), cookie.slice(index + 1))
    }
    return { response, data: await response.json().catch(() => null) }
  }
}

const results = []
async function check(name, run) {
  try { await run(); results.push({ name, ok: true }); console.log(`✓ ${name}`) }
  catch (error) { results.push({ name, ok: false, message: error.message }); console.log(`✗ ${name}: ${error.message.slice(0, 180)}`) }
}
try {
  await ready
  const client = new Client(), anonymous = new Client()
  await check('public reads, private access and API allowlist', async () => {
    assert.equal((await anonymous.request('/api/blog/knowledge')).data.data[0]._id, articleId)
    assert.equal((await anonymous.request('/api/blog/chat/history')).response.status, 401)
    assert.equal((await anonymous.request('/api/blog/moments/get?isEditing=true')).response.status, 401)
    assert.equal((await anonymous.request('/api/blog/admin/users')).response.status, 404)
  })
  await check('server-rendered public detail contracts', async () => {
    const articleResponse = await fetch(`${origin}/articles/${articleId}`)
    const articleHtml = await articleResponse.text()
    assert.equal(articleResponse.status, 200)
    assert.match(articleHtml, /A small record of time/)
    assert.match(articleHtml, /BlogPosting/)

    const momentResponse = await fetch(`${origin}/moments/${momentId}`)
    const momentHtml = await momentResponse.text()
    assert.equal(momentResponse.status, 200)
    assert.match(momentHtml, /October, a beginning/)
    assert.match(momentHtml, /SocialMediaPosting/)
  })
  await check('login: HttpOnly cookies, no token in JSON', async () => {
    const { data, response } = await client.request('/api/auth/login', { username: 'tester', password: 'fixture-password' })
    assert.equal(data.uid, 'test-admin')
    assert.equal(data.token, undefined)
    assert.ok(response.headers.getSetCookie().some(value => value.startsWith('blog_tokens=') && value.includes('HttpOnly')))
    assert.equal((await client.request('/api/session')).data.data.isAdmin, true)
  })
  await check('guest envelope normalization, cookie and verified session', async () => {
    const guest = new Client()
    const { data } = await guest.request('/api/auth/guest', undefined, 'POST')
    assert.ok(data.uid)
    assert.equal(JSON.stringify(data).includes('fixture-token'), false)
    assert.equal((await guest.request('/api/session')).data.data.isGuest, true)
    assert.equal((await guest.request('/api/blog/knowledge', { title: 'Forbidden' })).response.status, 403)
  })
  await check('anonymous links/comments via server-only reader', async () => {
    assert.equal((await anonymous.request('/api/blog/links')).response.status, 200)
    assert.equal((await anonymous.request('/api/blog/moments/comment/get', { commentIds: [commentId] })).data.data[0]._id, commentId)
    assert.equal(anonymous.jar.size, 0)
  })
  await check('legacy password fallback and backend error status', async () => {
    const legacy = new Client()
    assert.equal((await legacy.request('/api/auth/login', { username: 'legacy', password: 'fixture-password' })).response.status, 200)
    assert.equal((await legacy.request('/api/auth/login', { username: 'wrong', password: 'bad' })).response.status, 401)
  })
  await check('register and verification-code contract', async () => {
    const other = new Client()
    assert.equal((await other.request('/api/auth/code', { email: 'fixture@example.test' })).data.status, 'ok')
    assert.equal((await other.request('/api/auth/register', { username: 'new', password: 'fixture-password', email: 'fixture@example.test', verificationCode: '123456' })).data.uid, 'test-new')
    assert.equal((await other.request('/api/auth/register', { email: 'invalid' })).response.status, 400)
  })
  await check('forged uid cannot exploit V2 recovery', async () => {
    const forged = new Client()
    forged.jar.set('blog_active_uid', 'test-admin')
    forged.jar.set('blog_tokens', encodeURIComponent('test-admin:forged'))
    assert.equal((await forged.request('/api/session')).data.data, null)
    assert.equal((await forged.request('/api/auth/switch', { uid: 'test-admin' })).response.status, 401)
  })
  await check('CSRF rejected before backend writes', async () => {
    const before = calls.length
    assert.equal((await client.request('/api/blog/knowledge', {}, 'POST', { origin: 'https://untrusted.test' })).response.status, 403)
    assert.equal((await client.request('/api/session', undefined, 'DELETE', { 'sec-fetch-site': 'cross-site' })).response.status, 403)
    assert.equal((await client.request('/api/auth/guest', undefined, 'POST', { origin: 'https://untrusted.test' })).response.status, 403)
    assert.equal(calls.length, before)
  })
  await check('V1/V2 renewal, second account retention, switching/logout', async () => {
    await client.request('/api/auth/login', { username: 'second', password: 'fixture-password' })
    await client.request('/api/auth/switch', { uid: 'test-admin' })
    for (const kind of ['rotateV1', 'rotateV2']) {
      controls[kind] = true
      assert.equal((await client.request('/api/session')).data.data.uid, 'test-admin')
      const tokens = decodeURIComponent(client.jar.get('blog_tokens'))
      assert.ok(tokens.includes(`test-admin:${users.get('test-admin').token}`))
      assert.ok(tokens.includes('test-second:'))
      assert.equal(tokens.includes('unrelated:'), false)
    }
    await client.request('/api/session', undefined, 'DELETE')
    assert.ok(decodeURIComponent(client.jar.get('blog_tokens')).includes('test-second:'))
    assert.equal((await client.request('/api/session')).data.data, null)
    assert.equal((await client.request('/api/auth/switch', { uid: 'test-second' })).data.uid, 'test-second')
    await client.request('/api/auth/login', { username: 'tester', password: 'fixture-password' })
  })
  await check('article CRUD and server-controlled sender identity', async () => {
    const created = await client.request('/api/blog/knowledge', { title: 'Contract writing', content: 'Markdown content', category: 'Life', tags: [] })
    const id = created.data.data._id
    assert.equal((await client.request(`/api/blog/knowledge/${id}`, { title: 'Updated' }, 'PUT')).data.data.title, 'Updated')
    assert.equal((await client.request(`/api/blog/knowledge/${id}`, {}, 'DELETE')).response.status, 200)
    const chat = await client.request('/api/blog/chat/send', { type: 'group', text: 'Contract message', username: 'Spoof', identity: 'forged' })
    assert.equal(chat.data.data.username, 'tester')
    assert.equal(chat.data.data.identity, 'admin')
  })
  await check('multipart uploads, moment draft/publish/delete, comments/likes, links', async () => {
    const form = new FormData()
    form.set('title', 'Contract moment'); form.set('content', 'Moment content'); form.set('published', 'false')
    form.set('files', new Blob(['fixture'], { type: 'image/png' }), 'fixture.png')
    await client.request('/api/blog/moments/post', form)
    assert.equal((await client.request('/api/blog/moments/get?isEditing=true')).data.data.title, 'Contract moment')
    form.set('published', 'true')
    const created = await client.request('/api/blog/moments/post', form)
    assert.equal((await client.request('/api/blog/moments/delete', { momentId: created.data.data._id, moment_uid: 'test-admin' }, 'DELETE')).response.status, 200)
    assert.equal((await client.request('/api/blog/gallery/post', form)).data.data.count, 1)
    assert.equal((await client.request('/api/blog/chat/upload', form)).data.data.urls.length, 1)
    assert.ok((await client.request('/api/blog/knowledge/upload-image', form)).data.data.url)
    assert.equal((await client.request('/api/blog/moments/comment/post', { momentId, comment: 'Reply', belong: commentId })).data.data.belong, commentId)
    assert.equal((await client.request('/api/blog/moments/like', { momentId, like: true })).data.data.likes, 1)
    const link = { name: 'Source', url: 'https://example.test', category: 'friend' }
    assert.equal((await client.request('/api/blog/admin/links', link)).response.status, 200)
    assert.equal((await client.request(`/api/blog/admin/links/${commentId}`, link, 'PUT')).response.status, 200)
    assert.equal((await client.request(`/api/blog/admin/links/${commentId}`, {}, 'DELETE')).response.status, 200)
    assert.equal((await anonymous.request('/api/blog/guestbook', { username: 'Visitor', content: 'Hello' })).response.status, 200)
  })
  await check('SSE token redaction, malformed frames, renewal handoff', async () => {
    const response = await fetch(`${origin}/api/blog/sse/subscribe`, { headers: { cookie: [...client.jar].map(([key, value]) => `${key}=${value}`).join('; ') }, signal: AbortSignal.timeout(10000) })
    const reader = response.body.getReader(), decoder = new TextDecoder()
    let text = ''
    while (!text.includes('event: article')) { const chunk = await reader.read(); if (chunk.done) break; text += decoder.decode(chunk.value) }
    await reader.cancel()
    assert.equal(text.includes('fixture-token'), false)
    assert.equal(text.includes('event: token'), false)
    assert.ok(text.includes('event: session-refresh'))
    assert.ok(text.includes('event: chat'))
    assert.equal((await client.request('/api/session')).data.data.uid, 'test-admin')
  })
  await check('upstream errors remain actionable', async () => {
    controls.fail = true
    const { response, data } = await anonymous.request('/api/blog/knowledge')
    controls.fail = false
    assert.equal(response.status, 503)
    assert.equal(data.message, 'Fixture service unavailable')
  })
  await check('legacy links retain IDs and remaining query parameters', async () => {
    const routes = [
      [`/town/articles?kid=${articleId}&tag=one&tag=two`, `/articles/${articleId}?tag=one&tag=two`],
      [`/articles?kid=${articleId}&from=archive`, `/articles/${articleId}?from=archive`],
      [`/moments?mid=${momentId}&from=archive`, `/moments/${momentId}?from=archive`],
      ['/account/register?returnTo=%2Fchat', '/login?returnTo=%2Fchat&mode=register'],
      ['/town/chat/private', '/chat?legacyPrivate=1'],
    ]
    for (const [path, destination] of routes) {
      const response = await fetch(`${origin}${path}`, { redirect: 'manual' })
      const html = await response.text()
      const location = response.headers.get('location')
      assert.ok(location === destination || html.includes(destination.replaceAll('&', '&amp;')) || html.includes(destination), `Missing redirect for ${path}`)
    }
    assert.equal((await fetch(`${origin}/no-such-page`, { redirect: 'manual' })).status, 404)
  })
  await writeFile(resolve(work, '../contract-results.json'), JSON.stringify(results, null, 2))
  await writeFile(resolve(work, '../contract-next.log'), log)
  console.log(`\n${results.filter(result => result.ok).length}/${results.length} integration groups passed.`)
  if (process.argv.includes('--serve')) console.log(`Isolated browser preview: ${origin}/home (login: tester / fixture-password)`)
  else { stop(); process.exitCode = results.some(result => !result.ok) ? 1 : 0 }
} catch (error) {
  await writeFile(resolve(work, '../contract-next.log'), log)
  console.error(error.message); stop(); process.exitCode = 1
}
