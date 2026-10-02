import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sameOrigin, verifiedSession } from '@/lib/server/blog-session'

export async function GET() {
  try {
    return NextResponse.json({ data: (await verifiedSession())?.session ?? null }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ message: '暂时无法验证账号，请重试' }, { status: 503 })
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 })
  const store = await cookies()
  const uid = store.get('blog_active_uid')?.value
  const entries = (store.get('blog_tokens')?.value || '').split(',').filter(Boolean).filter(entry => !entry.startsWith(`${uid}:`))
  store.set('blog_tokens', entries.join(','), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 604800 })
  if (store.get('blog_guest_token')?.value.startsWith(`${uid}:`)) store.delete('blog_guest_token')
  store.delete('blog_active_uid')
  return NextResponse.json({ success: true })
}
