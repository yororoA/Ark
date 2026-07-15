import { useEffect, useRef } from "react";
import { authAction } from "@/app/actions/auth";
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

  const adminUids = process.env.NEXT_PUBLIC_ADMIN_UIDS?.split(',') || [];

  // 登录
  async function login(username: string, password: string) {
    const resp = await authAction('login', { username, password });
    if (resp) {
      authStore.addDetail({
        username, uid: resp.uid, isGuest: false,
        isAdmin: adminUids.includes(resp.uid),
        lastLoginAt: new Date().toISOString(),
        continent_code: location?.continentCode,
        country_code: location?.countryCode,
      });
    }
  }

  // 注册
  async function register(username: string, password: string, email: string, verificationCode: string) {
    const resp = await authAction('register', { username, password, email, verificationCode });
    if (resp) {
      authStore.addDetail({
        username, uid: resp.uid, isGuest: false,
        lastLoginAt: new Date().toISOString(),
        continent_code: location?.continentCode,
        country_code: location?.countryCode,
      });
    }
  }

  // 游客登录
  async function guestLogin() {
    const resp = await authAction('guest');
    if (resp) {
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
      }, new Date(resp.expiresAt).getTime() - Date.now());
      guests.current = [...guests.current, timeout];
    }
  }

  return ({
    login,
    register,
    guestLogin,
  });
}