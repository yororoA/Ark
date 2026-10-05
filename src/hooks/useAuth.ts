import { syncAuthDetails, useAuthStore } from "@/store/auth";
import { useGetLocation } from "@/hooks/useGetLocation";

class AuthRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * 调用 /api/auth/[action] Route Handler。
 *
 * Route Handler 通过 cookies().set() 写 cookie 不会触发 RSC 重渲染，
 * 替代了原来 Server Action 写 cookie 触发 RSC refresh 的实现 —— 后者
 * 会在登录页 commit 一份新的 RSC payload 进当前路由树，导致 Sphere /
 * BgImage / Portal 重渲染，视觉上出现"样式脱离再复位"瞬态。
 */
async function callAuth<T = unknown>(action: string, body?: unknown): Promise<T | null> {
  const resp = await fetch(`/api/auth/${action}`, {
    method: 'POST',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!resp.ok) {
    let message = `请求失败: ${resp.status} ${resp.statusText}`
    try {
      const err = await resp.json()
      if (err?.message) message = err.message
    } catch {
      // 非 JSON 响应，使用默认消息
    }
    throw new AuthRequestError(message, resp.status)
  }

  // switch 可能返回 null，其他 action 失败时也可能返回 null
  return resp.json()
}

export function useAuth() {
  const authStore = useAuthStore();
  const location = useGetLocation();

  // 验证码
  async function sendCode(email: string) {
    const resp = await callAuth<{ status?: string; message?: string }>('code', { email });
    if (!resp || resp.status !== 'ok') {
      throw new Error(resp?.message || '发送验证码失败');
    }
  }

  // 登录
  async function login(username: string, password: string) {
    const resp = await callAuth<{ uid?: string; isAdmin?: boolean }>('login', { username, password });
    if (!resp?.uid) {
      throw new Error('登录失败，请稍后重试');
    }
    authStore.addDetail({
      username, uid: resp.uid, isGuest: false,
      isAdmin: resp.isAdmin ?? false,
      lastLoginAt: new Date().toISOString(),
      continent_code: location?.continentCode,
      country_code: location?.countryCode,
    });
    void syncAuthDetails().catch(() => {});
  }

  // 注册
  async function register(username: string, password: string, email: string, verificationCode: string) {
    const resp = await callAuth<{ uid?: string; isAdmin?: boolean }>('register', { username, password, email, verificationCode });
    if (!resp?.uid) {
      throw new Error('注册失败，请稍后重试');
    }
    authStore.addDetail({
      username, uid: resp.uid, isGuest: false,
      isAdmin: resp.isAdmin ?? false,
      lastLoginAt: new Date().toISOString(),
      continent_code: location?.continentCode,
      country_code: location?.countryCode,
    });
    void syncAuthDetails().catch(() => {});
  }

  // 游客登录
  async function guestLogin() {
    const resp = await callAuth<{ uid: string; username?: string; expiresAt: string }>('guest');
    if (!resp) {
      throw new Error('游客登录失败，请稍后重试');
    }
    authStore.addDetail({
      uid: resp.uid,
      username: resp.username || 'Guest',
      isGuest: true,
      lastLoginAt: new Date().toISOString(),
      continent_code: location?.continentCode,
      country_code: location?.countryCode,
    });
    void syncAuthDetails().catch(() => {});
    // Session validity is checked server-side; a login-time timer would discard
    // guests whose tokens have since been renewed by the backend.
    return resp;
  }

  // 切换用户
  async function switchUser(uid: string) {
    let validated: { uid: string; username: string; isGuest: boolean; isAdmin: boolean } | null;
    try {
      // 设置 cookie + 后端轻量验证（Route Handler 内部手动携带 Cookie 头）
      validated = await callAuth<{ uid: string; username: string; isGuest: boolean; isAdmin: boolean } | null>('switch', { uid });
    } catch (error) {
      if (error instanceof AuthRequestError && error.status === 401) {
        authStore.removeDetail(uid);
        await fetch(`/api/session?uid=${encodeURIComponent(uid)}`, { method: 'DELETE' }).catch(() => null);
      }
      throw error;
    }

    if (validated) {
      // 后端验证通过 → 以后端数据为准（确保 token 仍有效）
      authStore.addDetail({
        username: validated.username,
        uid: validated.uid,
        isGuest: validated.isGuest,
        isAdmin: validated.isAdmin,
        lastLoginAt: new Date().toISOString(),
        continent_code: location?.continentCode,
        country_code: location?.countryCode,
      });
      void syncAuthDetails().catch(() => {});
    } else {
      // Local login history is display data, never proof of an active session.
      throw new Error('账号验证失败，请重新登录');
    }
  }

  return ({
    sendCode,
    login,
    register,
    guestLogin,
    switchUser,
  });
}
