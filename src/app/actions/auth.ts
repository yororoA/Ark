'use server';

import sha256 from 'crypto-js/sha256'
import hex from 'crypto-js/enc-hex'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { Api } from './api'

interface LoginRequest {
  username: string;
  password: string;
}

interface RegisterRequest {
  username: string;
  password: string;
  email: string;
  verificationCode: string;
}

interface CodeRequest {
  email: string;
}

type Auth = 'login' | 'register' | 'guest' | 'code';
type AuthReq = {
  login: LoginRequest;
  register: RegisterRequest;
  guest: never;
  code: CodeRequest;
}
type AuthRequest<T extends Auth> = AuthReq[T];

// 认证接口映射
const AuthUrlMap: Record<Auth, string> = {
  login: '/login',
  register: '/register',
  guest: '/guest/login',
  code: '/verification/send',
}

// 参数校验
const LoginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

const RegisterSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
  email: z.email({ error: '邮箱格式错误' }),
  verificationCode: z.string().length(6, '验证码长度错误，必须为6位数字'),
});

const CodeSchema = z.object({
  email: z.email({ error: '邮箱格式错误' }).min(1, '邮箱不能为空'),
});

// 密码加密
function encryptPassword(password: string) {
  return sha256(password).toString(hex)
}

// ── Cookie 转发工具 ──────────────────────────────────
// Server Action 的 fetch 是服务端对服务端，后端返回的 Set-Cookie 响应头
// 会被 Next.js 的 fetch 客户端丢弃，不会自动到达浏览器。
// 因此需要在 authAction 中从 JSON 响应体取出 uid/token，
// 通过 next/headers cookies().set() 手动下发到浏览器。
async function setAuthCookies(uid: string, token: string, isGuest = false) {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = isProduction;
  const sameSite = isProduction ? 'none' as const : 'lax' as const;

  if (isGuest) {
    // 游客：独立的 blog_guest_token cookie，短期有效
    cookieStore.set('blog_guest_token', `${uid}:${token}`, {
      httpOnly: true, secure, sameSite, path: '/', maxAge: 30 * 60,
    });
  } else {
    // 注册用户：blog_tokens（uid:token 数组）+ blog_active_uid
    const existing = cookieStore.get('blog_tokens')?.value || '';
    const entries = existing ? existing.split(',').filter(Boolean) : [];
    const idx = entries.findIndex(e => e.startsWith(uid + ':'));
    if (idx >= 0) {
      entries[idx] = `${uid}:${token}`;
    } else {
      entries.push(`${uid}:${token}`);
    }
    cookieStore.set('blog_tokens', entries.join(','), {
      httpOnly: true, secure, sameSite, path: '/', maxAge: 7 * 24 * 60 * 60,
    });
  }

  // 所有登录类型都设置当前活跃用户
  cookieStore.set('blog_active_uid', uid, {
    httpOnly: false, secure, sameSite, path: '/', maxAge: 365 * 24 * 60 * 60,
  });
}

// 函数重载
export async function authAction<T extends 'login' | 'register' | 'code'>(auth: T, request: AuthRequest<T>): Promise<ReturnType<typeof Api>>
export async function authAction<T extends 'guest'>(auth: 'guest'): Promise<ReturnType<typeof Api>>

// 认证操作主体
export async function authAction<T extends Auth>(auth: T, request?: AuthRequest<T>) {
  const api_url = '/api/v2' + AuthUrlMap[auth];

  if (auth === 'guest') {
    const resp = await Api(api_url, 'POST');
    if (resp && resp.uid && resp.token) {
      await setAuthCookies(resp.uid, resp.token, true);
    }
    return resp;
  }

  if (!request) {
    throw new Error('请求参数不能为空');
  }

  // 校验参数
  if (auth === 'login') {
    LoginSchema.parse(request);
  } else if (auth === 'register') {
    RegisterSchema.parse(request);
  } else if (auth === 'code') {
    CodeSchema.parse(request);
  }
  let payload = { ...request };

  if (auth === 'login' || auth === 'register') {
    (payload as LoginRequest | RegisterRequest).password = encryptPassword((payload as LoginRequest | RegisterRequest).password);
  }
  const adminUids = process.env.ADMIN_UIDS?.split(',') || [];
  const resp = await Api(api_url, 'POST', payload);
  if (resp && resp.uid) {
    resp.isAdmin = adminUids.includes(resp.uid);
  }
  // 转发 cookie：后端 Set-Cookie 被 server-to-server fetch 丢弃，
  // 需要手动从响应体取出 uid/token，通过 next/headers 下发到浏览器
  if (resp && resp.uid && resp.token) {
    await setAuthCookies(resp.uid, resp.token, auth === 'guest');
  }
  return resp;
}

// 切换用户 — 设置 blog_active_uid cookie + 轻量后端验证
// 验证通过 → 返回 { uid, username, isGuest, isAdmin }
// 验证失败 → 返回 null（cookie 已设置，不阻塞切换，后续实际请求会报错）
export async function switchAccount(uid: string) {
  const cookieStore = await cookies();

  // 1. 设置 blog_active_uid cookie
  cookieStore.set('blog_active_uid', uid, {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax',
    httpOnly: false,
  });

  // 2. 轻量后端验证：手动构造 Cookie 头（server-to-server fetch 不带浏览器 cookie）
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) return null;

  // 拼装 Cookie 头：从当前请求的 cookie 中读出 uid 对应的 token
  const activeUid = `blog_active_uid=${uid}`;
  const tokensValue = cookieStore.get('blog_tokens')?.value || '';
  const guestValue = cookieStore.get('blog_guest_token')?.value || '';
  const cookieParts = [activeUid];
  if (tokensValue) cookieParts.push(`blog_tokens=${tokensValue}`);
  if (guestValue) cookieParts.push(`blog_guest_token=${guestValue}`);
  const cookieHeader = cookieParts.join('; ');

  try {
    const response = await fetch(`${backendUrl}/api/v2/auth/me`, {
      headers: { Cookie: cookieHeader },
    });
    if (response.ok) {
      const adminUids = (process.env.ADMIN_UIDS || '').split(',').filter(Boolean);
      const data = await response.json();
      if (data.valid) {
        return {
          uid: data.uid,
          username: data.username,
          isGuest: data.isGuest ?? false,
          isAdmin: adminUids.includes(data.uid),
        };
      }
    }
  } catch {
    // 网络异常 / 后端未部署新版本 → 不抛错，交给后续实际请求处理
  }

  return null;
}
