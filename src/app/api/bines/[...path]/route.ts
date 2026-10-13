import { NextRequest, NextResponse } from 'next/server'
import { acceptRefresh, BackendError, credentialHeaders, sameOrigin, upstream, verifiedSession } from '@/lib/server/blog-session'

const routes: Record<string, RegExp> = {
  GET: /^(?:profile|admin)$/,
  PUT: /^admin\/profile$/,
  POST: /^admin\/credentials$/,
  DELETE: /^admin\/credentials\/[a-f0-9-]{36}$/,
}
const noStore = { 'Cache-Control': 'private, no-store' }

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const fail = (message: string, status: number) => NextResponse.json({ success: false, message }, { status, headers: noStore })
  try {
    const path = (await context.params).path.join('/')
    if (!routes[request.method]?.test(path)) return fail('接口不存在', 404)
    const isPublic = request.method === 'GET' && path === 'profile'
    if (!isPublic && !sameOrigin(request)) return fail('请求来源无效', 403)
    const auth = isPublic ? null : await verifiedSession()
    if (!isPublic && !auth) return fail('请先登录', 401)
    if (!isPublic && !auth?.session.isAdmin) return fail('需要管理员登录', 403)
    const headers = new Headers(auth ? credentialHeaders(auth.credential) : {})
    let body: string | undefined
    if (request.method === 'POST' || request.method === 'PUT') {
      const raw = await request.text()
      if (Buffer.byteLength(raw) > 8192) return fail('请求内容过长', 413)
      body = JSON.stringify(JSON.parse(raw))
      headers.set('Content-Type', 'application/json')
    }
    // Query and endpoint are explicitly allowlisted; incoming credentials and
    // client-supplied administrator/sender headers are never forwarded.
    const response = await upstream(`/api/bines/${path}`, { method: request.method, headers, body })
    if (auth) await acceptRefresh(response, auth.credential)
    const data = await response.json().catch(() => ({ success: false, message: '服务响应异常' }))
    return NextResponse.json(data, { status: response.status, headers: noStore })
  } catch (error) {
    const status = error instanceof BackendError ? error.status : error instanceof SyntaxError ? 400 : 502
    return fail(error instanceof BackendError ? error.message : status === 400 ? '请求格式无效' : '服务暂时不可用，请稍后重试', status)
  }
}

export const GET = handle
export const PUT = handle
export const POST = handle
export const DELETE = handle
