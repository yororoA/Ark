import { useEffect, useRef } from "react";
import { authAction, switchAccount } from "@/app/actions/auth";
import { useAuthStore } from "@/store/auth";
import { useGetLocation } from "@/hooks/useGetLocation";

export function useAuth() {
  const authStore = useAuthStore();
  const guests = useRef<ReturnType<typeof setTimeout>[]>([]);
  const location = useGetLocation();

  useEffect(() => {
    return () => {
      if (guests.current.length > 0) {
        guests.current.forEach(timeout => clearTimeout(timeout));
      }
    }
  }, []);

  // 验证码
  async function sendCode(email: string) {
    const resp = await authAction('code', { email });
    if (!resp || resp.status !== 'ok') {
      throw new Error(resp?.message || '发送验证码失败');
    }
  }

  // 登录
  async function login(username: string, password: string) {
    const resp = await authAction('login', { username, password });
    if (!resp) {
      throw new Error('登录失败，请稍后重试');
    }
    authStore.addDetail({
      username, uid: resp.uid, isGuest: false,
      isAdmin: resp.isAdmin ?? false,
      lastLoginAt: new Date().toISOString(),
      continent_code: location?.continentCode,
      country_code: location?.countryCode,
    });
  }

  // 注册
  async function register(username: string, password: string, email: string, verificationCode: string) {
    const resp = await authAction('register', { username, password, email, verificationCode });
    if (!resp) {
      throw new Error('注册失败，请稍后重试');
    }
    authStore.addDetail({
      username, uid: resp.uid, isGuest: false,
      isAdmin: resp.isAdmin ?? false,
      lastLoginAt: new Date().toISOString(),
      continent_code: location?.continentCode,
      country_code: location?.countryCode,
    });
  }

  // 游客登录
  async function guestLogin() {
    const resp = await authAction('guest');
    if (!resp) {
      throw new Error('游客登录失败，请稍后重试');
    }
    authStore.addDetail({
      uid: resp.uid,
      isGuest: true,
      lastLoginAt: new Date().toISOString(),
      continent_code: location?.continentCode,
      country_code: location?.countryCode,
    });
    // 游客登录过期清除游客登录状态
    const timeout = setTimeout(() => {
      authStore.removeDetail(resp.uid);
      guests.current = guests.current.filter((t) => t !== timeout);
    }, new Date(resp.expiresAt).getTime() - Date.now());
    guests.current.push(timeout);
  }

  // 切换用户
  async function switchUser(uid: string) {
    // 设置 cookie + 后端轻量验证（server action 内部手动携带 Cookie 头）
    const validated = await switchAccount(uid);

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
    } else {
      // 后端不可达 / 未部署新版本 → 回退本地 authStore
      const existingDetail = authStore.getDetail(uid);
      if (!existingDetail) {
        throw new Error('未找到用户信息，请重新登录');
      }
      authStore.addDetail({
        ...existingDetail,
        lastLoginAt: new Date().toISOString(),
        continent_code: location?.continentCode,
        country_code: location?.countryCode,
      });
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