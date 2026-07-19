import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createHash } from 'crypto'
import { z } from 'zod'
import { Api } from '@/lib/server/api'

/**
 * Auth Route Handler
 *
 * 把原来 Server Action 里的 authAction / switchAccount 迁过来。
 * 关键差异：Route Handler 通过 cookies().set() 写 cookie **不会**触发 RSC 重渲染，
 * 而 Server Action 写 cookie 会触发框架级自动 RSC refresh（Next.js 16 行为）。
 * 这正是登录页"样式脱离再复位"瞬态的根因。
 *
 * 路由：
 *   POST /api/auth/login      用户名密码登录
 *   POST /api/auth/register   注册
 *   POST /api/auth/guest      游客登录（无 body）
 *   POST /api/auth/code       发送验证码
 *   POST /api/auth/switch     切换当前活跃账号
 */

// ── 类型 ─────────────────────────────────────────────
type Auth = 'login' | 'register' | 'guest' | 'code'

const AuthUrlMap: Record<Auth, string> = {
  login: '/login',
  register: '/register',
  guest: '/guest/login',
  code: '/verification/send',
}

// ── 校验 schema ─────────────────────────────────────
const LoginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
})

const RegisterSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
  email: z.email({ error: '邮箱格式错误' }),
  verificationCode: z.string().length(6, '验证码长度错误，必须为6位数字'),
})

const CodeSchema = z.object({
  email: z.email({ error: '邮箱格式错误' }).min(1, '邮箱不能为空'),
})

const SwitchSchema = z.object({
  uid: z.string().min(1, 'uid 不能为空'),
})

// ── 工具：密码加密 / 写 cookie ──────────────────────
function encryptPassword(password: string) {
  return createHash('sha256').update(password).digest('hex')
}

/**
 * Server-to-server fetch 会丢弃后端 Set-Cookie，
 * 因此从 JSON 响应体取出 uid/token，通过 cookies().set() 手动下发到浏览器。
 *
 * 注意：在 Route Handler 里写 cookie 不会触发 RSC 重渲染，
 * 与原 Server Action 行为不同 —— 这正是我们想要的。
 */
async function setAuthCookies(uid: string, token: string, isGuest = false) {
  const cookieStore = await cookies()
  const isProduction = process.env.NODE_ENV === 'production'
  const secure = isProduction
  const sameSite = isProduction ? 'none' as const : 'lax' as const

  if (isGuest) {
    // 游客：独立的 blog_guest_token cookie，短期有效
    cookieStore.set('blog_guest_token', `${uid}:${token}`, {
      httpOnly: true, secure, sameSite, path: '/', maxAge: 30 * 60,
    })
  } else {
    // 注册用户：blog_tokens（uid:token 数组）+ blog_active_uid
    const existing = cookieStore.get('blog_tokens')?.value || ''
    const entries = existing ? existing.split(',').filter(Boolean) : []
    const idx = entries.findIndex(e => e.startsWith(uid + ':'))
    if (idx >= 0) {
      entries[idx] = `${uid}:${token}`
    } else {
      entries.push(`${uid}:${token}`)
    }
    cookieStore.set('blog_tokens', entries.join(','), {
      httpOnly: true, secure, sameSite, path: '/', maxAge: 7 * 24 * 60 * 60,
    })
  }

  // 所有登录类型都设置当前活跃用户
  cookieStore.set('blog_active_uid', uid, {
    httpOnly: false, secure, sameSite, path: '/', maxAge: 365 * 24 * 60 * 60,
  })
}

// ── 主入口 ──────────────────────────────────────────
export async function POST(req: NextRequest, ctx: RouteContext<'/api/auth/[action]'>) {
  const { action } = await ctx.params

  // ─── switch：切换当前活跃账号 ───────────────────
  if (action === 'switch') {
    return handleSwitch(req)
  }

  // ─── guest：无 body ────────────────────────────
  if (action === 'guest') {
    return handleGuest()
  }

  // ─── login / register / code：带 JSON body ────
  return handleAuthWithBody(req, action as Auth)
}

// ── guest ───────────────────────────────────────────
async function handleGuest() {
  try {
    const resp = await Api('/api/v2' + AuthUrlMap.guest, 'POST')
    if (resp && resp.uid && resp.token) {
      await setAuthCookies(resp.uid, resp.token, true)
    }
    return NextResponse.json(resp ?? null)
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : '游客登录失败' },
      { status: 500 }
    )
  }
}

// ── login / register / code ────────────────────────
async function handleAuthWithBody(req: NextRequest, action: Auth) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: '请求体不是合法 JSON' }, { status: 400 })
  }

  // 参数校验
  try {
    if (action === 'login') LoginSchema.parse(body)
    else if (action === 'register') RegisterSchema.parse(body)
    else if (action === 'code') CodeSchema.parse(body)
  } catch (err) {
    const message = err instanceof z.ZodError
      ? err.issues.map(i => i.message).join('; ')
      : '参数校验失败'
    return NextResponse.json({ message }, { status: 400 })
  }

  const payload: Record<string, unknown> = { ...(body as Record<string, unknown>) }

  // 密码加密（login / register）
  if (action === 'login' || action === 'register') {
    payload.password = encryptPassword(payload.password as string)
  }

  const api_url = '/api/v2' + AuthUrlMap[action]

  try {
    const resp = await Api(api_url, 'POST', payload)
    if (resp && (action === 'login' || action === 'register') && resp.uid && resp.token) {
      const adminUids = process.env.ADMIN_UIDS?.split(',') || []
      resp.isAdmin = adminUids.includes(resp.uid)
      await setAuthCookies(resp.uid, resp.token, false)
    }
    return NextResponse.json(resp ?? null)
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : '请求失败' },
      { status: 500 }
    )
  }
}

// ── switch：切换活跃账号 + 后端轻量验证 ─────────────
async function handleSwitch(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: '请求体不是合法 JSON' }, { status: 400 })
  }

  const parsed = SwitchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues.map(i => i.message).join('; ') },
      { status: 400 }
    )
  }
  const { uid } = parsed.data

  const cookieStore = await cookies()

  // 1. 设置 blog_active_uid cookie
  cookieStore.set('blog_active_uid', uid, {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax',
    httpOnly: false,
  })

  // 2. 轻量后端验证：手动构造 Cookie 头（server-to-server fetch 不带浏览器 cookie）
  const backendUrl = process.env.BACKEND_URL
  if (!backendUrl) {
    return NextResponse.json(null)
  }

  const activeUid = `blog_active_uid=${uid}`
  const tokensValue = cookieStore.get('blog_tokens')?.value || ''
  const guestValue = cookieStore.get('blog_guest_token')?.value || ''
  const cookieParts = [activeUid]
  if (tokensValue) cookieParts.push(`blog_tokens=${tokensValue}`)
  if (guestValue) cookieParts.push(`blog_guest_token=${guestValue}`)
  const cookieHeader = cookieParts.join('; ')

  try {
    const response = await fetch(`${backendUrl}/api/v2/auth/me`, {
      headers: { Cookie: cookieHeader },
    })
    if (response.ok) {
      const adminUids = (process.env.ADMIN_UIDS || '').split(',').filter(Boolean)
      const data = await response.json()
      if (data.valid) {
        return NextResponse.json({
          uid: data.uid,
          username: data.username,
          isGuest: data.isGuest ?? false,
          isAdmin: adminUids.includes(data.uid),
        })
      }
    }
  } catch {
    // 网络异常 / 后端未部署新版本 → 不抛错，交给后续实际请求处理
  }

  return NextResponse.json(null)
}
