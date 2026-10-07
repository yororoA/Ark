import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { acceptRefresh, BackendError, credentialHeaders, publicReader, rememberRenewal, sameOrigin, upstream, verifiedSession } from '@/lib/server/blog-session'

export const maxDuration = 120

const mediaUploads = new Set(['moments/post', 'gallery/post', 'chat/upload', 'knowledge/upload-image'])
const routes: Record<string, RegExp[]> = {
  GET: [
    /^knowledge(?:\/(?:[a-f0-9]{24}|meta\/categories|liked))?$/,
    /^moments\/(?:[a-f0-9]{24}|get|summary|files|liked|comments\/liked)$/, /^gallery\/get$/,
    /^archive(?:\/(?:stats|feed|years|sitemap))?$/, /^(?:about|links|guestbook)$/, /^status\/bines$/, /^github\/summary$/,
    /^chat\/(?:conversations|history|hasPrivate)$/, /^sse\/subscribe$/,
  ],
  POST: [/^knowledge(?:\/(?:like|view|upload-image))?$/, /^moments\/(?:post|view|like|comment\/(?:get|post|like))$/, /^gallery\/post$/, /^guestbook$/, /^chat\/(?:send|upload)$/, /^admin\/links$/],
  PUT: [/^knowledge\/[a-f0-9]{24}$/, /^admin\/links\/[a-f0-9]{24}$/],
  DELETE: [/^knowledge\/[a-f0-9]{24}$/, /^moments\/delete$/, /^admin\/links\/[a-f0-9]{24}$/],
}
const publicGets = /^(knowledge(?:\/(?:[a-f0-9]{24}|meta\/categories))?|moments\/(?:[a-f0-9]{24}|get|summary|files)|gallery\/get|archive(?:\/(?:stats|feed|years|sitemap))?|about|guestbook|status\/bines|github\/summary)$/

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await context.params).path.join('/')
    const method = request.method
    const isRead = method === 'GET'
    if (!routes[method]?.some(pattern => pattern.test(path))) return NextResponse.json({ message: '接口不存在' }, { status: 404 })
    if (!isRead && !sameOrigin(request)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 })
    const isDraft = path === 'moments/get' && request.nextUrl.searchParams.get('isEditing')?.toLowerCase() === 'true'
    const isPublic = (isRead && publicGets.test(path) && !isDraft) || path === 'knowledge/view' || path === 'moments/view' || (method === 'POST' && path === 'guestbook')
    const isReader = (isRead && path === 'links') || (method === 'POST' && path === 'moments/comment/get')
    const auth = !isPublic && !isReader ? await verifiedSession() : null
    if (!isPublic && !isReader && !auth) return NextResponse.json({ message: '请先登录', tokenError: true }, { status: 401 })
    const credential = auth?.credential ?? (isReader ? await publicReader() : null)
    const headers = new Headers(credential ? credentialHeaders(credential) : {})
    if (path === 'knowledge/view' || path === 'moments/view') {
      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
      if (clientIp) headers.set('x-forwarded-for', clientIp)
      const userAgent = request.headers.get('user-agent')
      if (userAgent) headers.set('user-agent', userAgent)
    }
    let body: BodyInit | undefined
    if (!isRead) {
      const multipart = request.headers.get('content-type')?.includes('multipart/form-data')
      if (multipart) {
        body = await request.formData()
      } else {
        const json = await request.json()
        // Never trust a client-provided sender identity or administrator badge.
        if (path === 'chat/send' && auth) {
          json.username = auth.session.username
          json.identity = auth.session.isAdmin ? 'admin' : auth.session.isGuest ? 'guest' : 'user'
        }
        headers.set('content-type', 'application/json')
        body = JSON.stringify(json)
      }
    }
    const isMediaUpload = method === 'POST' && mediaUploads.has(path)
    let upstreamSignal: AbortSignal | undefined
    if (path === 'sse/subscribe') upstreamSignal = request.signal
    else if (isMediaUpload) upstreamSignal = AbortSignal.timeout(120_000)
    const response = await upstream(`/api/${path}${request.nextUrl.search}`, {
      method, headers, body, signal: upstreamSignal,
    })
    if (credential && auth) await acceptRefresh(response, credential)
    if (credential && isReader) {
      const token = response.headers.get('x-refreshed-token')
      if (token) rememberRenewal(credential, token)
    }
    if (path === 'sse/subscribe' && response.ok && response.body && credential) {
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
      let pending = ''
      const stream = response.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          // Normalize after concatenation: CR and LF can arrive in different chunks.
          pending = (pending + decoder.decode(chunk, { stream: true })).replace(/\r\n/g, '\n')
          let boundary: number
          while ((boundary = pending.indexOf('\n\n')) >= 0) {
            const event = pending.slice(0, boundary)
            pending = pending.slice(boundary + 2)
            if (/^event:\s*token$/m.test(event)) {
              const payload = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n')
              try {
                const token = JSON.parse(payload)?.data?.token
                if (typeof token === 'string') rememberRenewal(credential, token)
              } catch { /* Malformed token frames must never reach the browser. */ }
              controller.enqueue(encoder.encode('event: session-refresh\ndata: {}\n\n'))
            } else {
              controller.enqueue(encoder.encode(`${event}\n\n`))
            }
          }
        },
      }))
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } })
    }
    const data = await response.json().catch(() => ({ message: '博客服务响应异常' }))
    const changesPublishedContent = (
      (method === 'POST' && (path === 'knowledge' || path === 'moments/post'))
      || (method === 'PUT' && /^knowledge\/[a-f0-9]{24}$/.test(path))
      || (method === 'DELETE' && (/^knowledge\/[a-f0-9]{24}$/.test(path) || path === 'moments/delete'))
    )
    if (response.ok && changesPublishedContent) revalidateTag('public-blog-content', { expire: 0 })
    return NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const status = error instanceof BackendError ? error.status : error instanceof SyntaxError ? 400 : 502
    return NextResponse.json({ message: error instanceof BackendError ? error.message : status === 400 ? '请求格式无效' : '博客服务暂时不可用，请稍后重试' }, { status })
  }
}

export const GET = handle
export const POST = handle
export const PUT = handle
export const DELETE = handle
