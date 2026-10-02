import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { z } from 'zod'
import { Api, ApiError } from '@/lib/server/api'
import { sameOrigin, verifiedSession, saveCredential } from '@/lib/server/blog-session'

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
  await saveCredential({ uid, token, guest: isGuest }, true)
}

// ── 主入口 ──────────────────────────────────────────
export async function POST(req: NextRequest, ctx: RouteContext<'/api/auth/[action]'>) {
  const { action } = await ctx.params
  if (!sameOrigin(req)) return NextResponse.json({ message: '请求来源无效' }, { status: 403 })
  if (!['switch', 'guest', 'login', 'register', 'code'].includes(action)) {
    return NextResponse.json({ message: '接口不存在' }, { status: 404 })
  }

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
    // Guest endpoints wrap credentials in data; regular login does not.
    const guest = resp?.data
    if (!guest?.uid || !guest?.token) throw new ApiError('游客登录响应无效', 502)
    await setAuthCookies(guest.uid, guest.token, true)
    return NextResponse.json({ uid: guest.uid, username: guest.username || 'Guest', isGuest: true, expiresAt: guest.expiresAt })
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : '游客登录失败' },
      { status: err instanceof ApiError ? err.status : 502 }
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
    if (action === 'login') body = LoginSchema.parse(body)
    else if (action === 'register') body = RegisterSchema.parse(body)
    else if (action === 'code') body = CodeSchema.parse(body)
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
    let resp
    try {
      resp = await Api(api_url, 'POST', payload)
    } catch (err) {
      // Old bcrypt accounts predate the client's SHA-256 convention. Match the
      // original site's one-time migration only when the backend identifies it.
      const isLegacyLogin = action === 'login' && err instanceof ApiError && err.hint === 'legacy_user_detected'
      if (!isLegacyLogin) throw err
      resp = await Api(api_url, 'POST', { ...(body as Record<string, unknown>), isLegacy: true })
    }
    if (resp && (action === 'login' || action === 'register') && resp.uid && resp.token) {
      const adminUids = process.env.ADMIN_UIDS?.split(',') || []
      resp.isAdmin = adminUids.includes(resp.uid)
      await setAuthCookies(resp.uid, resp.token, false)
    }
    if (resp) delete resp.token
    return NextResponse.json(resp ?? null)
  } catch (err) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : '请求失败' },
      { status: err instanceof ApiError ? err.status : 502 }
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
  try {
    const auth = await verifiedSession(uid)
    if (!auth) return NextResponse.json({ message: '账号已过期，请重新登录' }, { status: 401 })
    await saveCredential(auth.credential, true)
    return NextResponse.json(auth.session)
  } catch {
    return NextResponse.json({ message: '账号验证暂时不可用' }, { status: 503 })
  }
}
