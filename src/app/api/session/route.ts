import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { sameOrigin, verifiedSession, type Session } from '@/lib/server/blog-session'

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 604800,
}

function uidFromCredential(value: string) {
  const separator = value.indexOf(':')
  return separator > 0 ? value.slice(0, separator) : ''
}

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get('all') === 'true') {
      const store = await cookies()
      const tokenEntries = (store.get('blog_tokens')?.value || '').split(',').filter(Boolean)
      const guestEntry = store.get('blog_guest_token')?.value || ''
      const uids = [...new Set([
        ...tokenEntries.map(uidFromCredential),
        uidFromCredential(guestEntry),
      ].filter(Boolean))]
      const sessions: Session[] = []

      for (const uid of uids) {
        const auth = await verifiedSession(uid)
        if (auth) sessions.push(auth.session)
      }

      const validUids = new Set(sessions.map(session => session.uid))
      const refreshedStore = await cookies()
      const validTokenEntries = (refreshedStore.get('blog_tokens')?.value || '')
        .split(',')
        .filter(Boolean)
        .filter(entry => validUids.has(uidFromCredential(entry)))
      if (validTokenEntries.length) {
        refreshedStore.set('blog_tokens', validTokenEntries.join(','), cookieOptions)
      } else {
        refreshedStore.delete('blog_tokens')
      }

      const refreshedGuest = refreshedStore.get('blog_guest_token')?.value || ''
      const guestUid = uidFromCredential(refreshedGuest)
      if (guestUid && !validUids.has(guestUid)) refreshedStore.delete('blog_guest_token')

      const activeUid = refreshedStore.get('blog_active_uid')?.value || null
      if (activeUid && !validUids.has(activeUid)) refreshedStore.delete('blog_active_uid')

      return NextResponse.json({
        data: sessions,
        activeUid: activeUid && validUids.has(activeUid) ? activeUid : null,
      }, { headers: { 'Cache-Control': 'private, no-store' } })
    }

    return NextResponse.json({ data: (await verifiedSession())?.session ?? null }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ message: '暂时无法验证账号，请重试' }, { status: 503 })
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 })
  const store = await cookies()
  const requestedUid = new URL(request.url).searchParams.get('uid')
  const uid = requestedUid || store.get('blog_active_uid')?.value
  if (!uid) return NextResponse.json({ success: true })

  const entries = (store.get('blog_tokens')?.value || '')
    .split(',')
    .filter(Boolean)
    .filter(entry => uidFromCredential(entry) !== uid)
  if (entries.length) store.set('blog_tokens', entries.join(','), cookieOptions)
  else store.delete('blog_tokens')
  if (store.get('blog_guest_token')?.value.startsWith(`${uid}:`)) store.delete('blog_guest_token')
  if (store.get('blog_active_uid')?.value === uid) store.delete('blog_active_uid')
  return NextResponse.json({ success: true })
}
