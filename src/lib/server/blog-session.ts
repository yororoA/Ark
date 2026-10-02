import 'server-only'
import { cookies } from 'next/headers'

export type Session = { uid: string; username: string; isGuest: boolean; isAdmin: boolean }
type Credential = { uid: string; token: string; guest: boolean }
type Renewal = { token: string; until: number }

// Only credentials already verified upstream may enter this map. It bridges SSE
// rotations until the browser's next same-origin request can update its cookie.
const state = globalThis as typeof globalThis & {
  arkRenewals?: Map<string, Renewal>
  arkPublicReader?: Promise<Credential>
  arkPublicReaderUntil?: number
}
const renewals = state.arkRenewals ??= new Map<string, Renewal>()

export class BackendError extends Error {
  constructor(message: string, public status = 502) { super(message) }
}

export function backendUrl(path: string) {
  const base = process.env.BACKEND_URL
  if (!base) throw new BackendError('博客服务尚未配置', 503)
  return `${base.replace(/\/$/, '')}${path}`
}

export async function upstream(path: string, init: RequestInit = {}) {
  return fetch(backendUrl(path), {
    ...init, cache: 'no-store', redirect: 'error',
    signal: init.signal ?? AbortSignal.timeout(30_000),
  })
}

export function rememberRenewal(credential: Credential, token: string) {
  if (!token || token === credential.token) return
  const now = Date.now()
  for (const [key, entry] of renewals) if (entry.until < now) renewals.delete(key)
  if (renewals.size > 5000) renewals.clear()
  renewals.set(`${credential.uid}:${credential.token}`, { token, until: now + 3_600_000 })
  credential.token = token
}

export async function saveCredential(credential: Credential, activate = false) {
  const store = await cookies()
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' }
  if (credential.guest) {
    store.set('blog_guest_token', `${credential.uid}:${credential.token}`, { ...options, maxAge: 1800 })
  } else {
    const entries = (store.get('blog_tokens')?.value || '').split(',').filter(Boolean)
      .filter(entry => !entry.startsWith(`${credential.uid}:`))
    entries.push(`${credential.uid}:${credential.token}`)
    store.set('blog_tokens', entries.join(','), { ...options, maxAge: 604800 })
  }
  if (activate) store.set('blog_active_uid', credential.uid, { ...options, httpOnly: false, maxAge: 31536000 })
}

export async function credentialFor(uid?: string): Promise<Credential | null> {
  const store = await cookies()
  const active = uid || store.get('blog_active_uid')?.value
  if (!active) return null
  const guest = store.get('blog_guest_token')?.value || ''
  const isGuest = guest.startsWith(`${active}:`)
  const entry = isGuest ? guest : (store.get('blog_tokens')?.value || '').split(',').find(e => e.startsWith(`${active}:`))
  if (!entry) return null
  const credential = { uid: active, token: entry.slice(active.length + 1), guest: isGuest }
  for (let i = 0; i < 10; i++) {
    const renewal = renewals.get(`${credential.uid}:${credential.token}`)
    if (!renewal || renewal.until < Date.now()) break
    credential.token = renewal.token
  }
  return credential
}

export function credentialHeaders(credential: Credential) {
  return { Authorization: `Bearer ${credential.token}`, uid: credential.uid }
}

export async function acceptRefresh(response: Response, credential: Credential) {
  let token = response.headers.get('x-refreshed-token')
  // V2 returns its rotation in Set-Cookie. Only import this verified account's
  // token, never the upstream active uid or an unrelated user's cookie entry.
  for (const header of response.headers.getSetCookie()) {
    const match = /^(?:blog_tokens|blog_guest_token)=([^;]*)/i.exec(header)
    if (!match) continue
    try {
      const entry = decodeURIComponent(match[1]).split(',').find(value => value.startsWith(`${credential.uid}:`))
      if (entry) token = entry.slice(credential.uid.length + 1)
    } catch { /* Ignore malformed upstream cookie values. */ }
  }
  if (token) rememberRenewal(credential, token)
  await saveCredential(credential)
}

export async function verifiedSession(uid?: string): Promise<{ session: Session; credential: Credential } | null> {
  const credential = await credentialFor(uid)
  if (!credential) return null
  // V2 has an unsafe uid-only recovery fallback. Validate BOTH uid and token
  // through V1 first; this endpoint rejects a userId different from req.user.uid.
  const check = await upstream(`/api/chat/hasPrivate?userId=${encodeURIComponent(credential.uid)}`, {
    headers: credentialHeaders(credential),
  })
  if (check.status === 401 || check.status === 400) return null
  if (!check.ok) throw new BackendError('账号验证暂时不可用', check.status)
  await acceptRefresh(check, credential)
  const response = await upstream('/api/v2/auth/me', {
    headers: { Cookie: `blog_active_uid=${encodeURIComponent(credential.uid)}; blog_tokens=${encodeURIComponent(`${credential.uid}:${credential.token}`)}` },
  })
  if (!response.ok) return null
  const data = await response.json()
  if (!data.valid || data.uid !== credential.uid) return null
  await acceptRefresh(response, credential)
  const admins = (process.env.ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean)
  return {
    credential,
    session: { uid: data.uid, username: data.username || 'Guest', isGuest: !!data.isGuest, isAdmin: !data.isGuest && admins.includes(data.uid) },
  }
}

// The old API requires a guest credential even for reading links and comments.
// This server-only reader grants no publishing rights and never becomes a user session.
export async function publicReader() {
  if (!state.arkPublicReader || (state.arkPublicReaderUntil || 0) < Date.now()) {
    state.arkPublicReaderUntil = Date.now() + 20 * 60_000
    state.arkPublicReader = upstream('/api/guest/login', { method: 'POST' }).then(async response => {
      if (!response.ok) throw new BackendError('暂时无法读取内容')
      const { data } = await response.json()
      if (!data?.uid || !data?.token) throw new BackendError('暂时无法读取内容')
      return { uid: data.uid, token: data.token, guest: true }
    }).catch(error => { state.arkPublicReader = undefined; throw error })
  }
  return state.arkPublicReader
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const isCrossSite = request.headers.get('sec-fetch-site') === 'cross-site'
  if (isCrossSite) return false
  if (!origin) return true
  try {
    const source = new URL(origin)
    // Next may normalize request.url to localhost internally. The browser's
    // actual Host remains authoritative, including behind TLS termination.
    const host = request.headers.get('host') || new URL(request.url).host
    return /^https?:$/.test(source.protocol) && source.origin === origin && source.host === host
  } catch { return false }
}
