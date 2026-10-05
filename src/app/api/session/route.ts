import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { sameOrigin, upstream, verifiedSession, type Session } from '@/lib/server/blog-session'

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

function parseCredential(value: string) {
  const separator = value.indexOf(':')
  if (separator <= 0) return null
  return { uid: value.slice(0, separator), token: value.slice(separator + 1) }
}

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get('all') === 'true') {
      const store = await cookies()
      const tokenEntries = (store.get('blog_tokens')?.value || '').split(',').filter(Boolean).slice(-5)
      const guestEntry = store.get('blog_guest_token')?.value || ''
      const accounts = tokenEntries.map(parseCredential).filter((credential): credential is NonNullable<typeof credential> => !!credential)
      const guestCredential = parseCredential(guestEntry)
      if (guestCredential && !accounts.some(account => account.uid === guestCredential.uid)) {
        accounts.push(guestCredential)
      }
      const validation = await upstream('/api/session/accounts/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts }),
      })
      if (!validation.ok) throw new Error('账号验证失败')
      const payload = await validation.json() as {
        data?: Array<{ uid: string; username?: string; isGuest?: boolean; token: string }>
      }
      if (!Array.isArray(payload.data)) throw new Error('账号验证响应无效')

      const admins = new Set((process.env.ADMIN_UIDS || '').split(',').map(value => value.trim()).filter(Boolean))
      const sessions: Session[] = payload.data.map(account => ({
        uid: account.uid,
        username: account.username || 'Guest',
        isGuest: !!account.isGuest,
        isAdmin: !account.isGuest && admins.has(account.uid),
      }))
      const validUids = new Set(sessions.map(session => session.uid))
      const validatedByUid = new Map(payload.data.map(account => [account.uid, account]))
      const refreshedStore = await cookies()
      const validTokenEntries = tokenEntries.flatMap(entry => {
        const uid = uidFromCredential(entry)
        const validated = validatedByUid.get(uid)
        return validated && !validated.isGuest ? [`${uid}:${validated.token}`] : []
      })
      if (validTokenEntries.length) {
        refreshedStore.set('blog_tokens', validTokenEntries.join(','), cookieOptions)
      } else {
        refreshedStore.delete('blog_tokens')
      }

      const validGuest = payload.data.find(account => account.isGuest)
      if (validGuest) {
        refreshedStore.set('blog_guest_token', `${validGuest.uid}:${validGuest.token}`, { ...cookieOptions, maxAge: 1800 })
      } else if (guestEntry) {
        refreshedStore.delete('blog_guest_token')
      }

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
