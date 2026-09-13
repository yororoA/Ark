'use client'
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useGetLocation } from '@/hooks/useGetLocation';
import { useBrightness } from '@/context/brightness-context';
import { useAuthStore } from '@/store/auth';

import Button from "@/components/arks/button";
import styles from './login.module.scss';
import { cn } from '@/lib/utils';
import Image from "next/image";
import Declaration from "./components/declaration";
import AccountManagement from "./components/accountManagement";
import ConnectionSequence, { type ConnectionState } from "./components/connectionSequence";
import Sphere from "@/components/arks/sphere";
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import type { ConnectParams } from './types';

export default function Login() {
  const location = useGetLocation(); // 用户ip定位
  const { setDimmed } = useBrightness(); // 登录页背景图亮度
  const ensureInitialized = useAuthStore((state) => state.ensureInitialized);
  const initialized = useAuthStore((state) => state.initialized);
  const rawDetails = useAuthStore((state) => {
    return state.details
  });
  // 按最后登录时间排序，最新在最前面
  const details = useMemo(() => [...rawDetails].sort((a, b) =>
    b.lastLoginAt?.localeCompare(a.lastLoginAt || '') || 0
  ), [rawDetails]);

  useEffect(() => {
    ensureInitialized();
  }, [ensureInitialized]);

  const nav = `from-[#3f3f3f]/99 from-60% to-[#3f3f3f]/80`

  const [isDeclarationVisible, setIsDeclarationVisible] = useState(false);
  const [isAccountManagementVisible, setIsAccountManagementVisible] = useState(false);
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const connectingRef = useRef(false);
  const requestIdRef = useRef(0);
  const isConnecting = connection !== null;
  // 首次登录强制打开账号管理，连接期间让位于终端动效。
  const showAccountManagement = initialized && (details.length === 0 || isAccountManagementVisible) && !isConnecting;

  const sphereClassName = 'translate-y-[-17rem] scale-[1.2] opacity-[0.5]';

  const { switchUser, register, login } = useAuth();
  const router = useRouter();
  // 连接按钮点击事件
  const handleConnect = async (params: ConnectParams) => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    const requestId = ++requestIdRef.current;
    const uid = params.action === 'switch' ? params.uid || details[0]?.uid || '' : '';
    const username = params.action === 'switch'
      ? details.find((detail) => detail.uid === uid)?.username || 'Guest'
      : params.username;

    setConnection({ status: 'pending', username });
    setIsDeclarationVisible(false);
    setDimmed(true);

    try {
      if (params.action === 'switch') await switchUser(uid);
      else if (params.action === 'register') await register(params.username, params.password, params.email, params.code);
      else if (params.action === 'login') await login(params.username, params.password);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setConnection({
        status: 'error',
        username,
        error: err instanceof Error ? err.message : '连接失败，请稍后重试',
      });
      return;
    }

    if (requestId === requestIdRef.current) {
      setConnection({ status: 'success', username });
    }
  }

  const handleConnected = useCallback(() => {
    setDimmed(false);
    router.replace('/home');
  }, [router, setDimmed]);

  const handleDismissConnection = useCallback(() => {
    connectingRef.current = false;
    setConnection(null);
    setDimmed(false);
    setIsAccountManagementVisible(true);
  }, [setDimmed]);

  // Ignore late responses after navigation and restore the shared background.
  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      setDimmed(false);
    };
  }, [setDimmed]);

  return (
    <>
      {connection && (
        <ConnectionSequence
          {...connection}
          location={location ? `${location.continentCode}/${location.countryCode}` : '-- / --'}
          onComplete={handleConnected}
          onDismiss={handleDismissConnection}
        />
      )}
      <div className={styles['login-scene']} inert={isConnecting}>
        {!isConnecting && <>
          <Sphere className={sphereClassName} color='rgba(34,211,238,.5)' edges={10} edgeWidth={2} dotRadius={3} />
          <Sphere className={cn(sphereClassName, 'rotate-z-[90deg] rotate-x-[20deg]')} color="rgba(192,132,252,0.8)" edges={6} edgeWidth={2} dotRadius={3} />
        </>}
        <span className={cn(styles.light)} />
        <span className={cn(styles.nav, 'bg-gradient-to-b', nav)} />
        <div className={cn(styles.main, "relative w-full flex justify-center flex-1")} style={{ opacity: showAccountManagement ? 0 : 1, visibility: isConnecting ? 'hidden' : 'visible', pointerEvents: showAccountManagement || isConnecting ? 'none' : 'auto' }}>
          <div className={cn(styles.bines_sign, 'absolute w-full pointer-events-none z-[0]')} style={{ aspectRatio: '16/8' }}>
            <Image src="/bines_sign.png" loading="eager" fill alt="logo" className="object-contain" />
          </div>
          {initialized && <>
            <span className={cn(styles.pro_tag, 'font-batang z-[1]')}>{'YOROROICE ARK'}</span>
            <Button size="large" className="font-song z-[1]" onClick={() => handleConnect({ action: 'switch' })}>{'建立连接'}</Button>
            <div className={cn(styles.tag)}>
              <span className={cn(styles.tag_prefix, 'z-[1]')}>{details[0]?.isAdmin ? '管理员' : details[0]?.isGuest ? '访客' : '用户'}</span>
              <span className={cn(styles.tag_suffix, 'relative z-[1]')}>{details[0]?.username}</span>
            </div>
          </>}
        </div>
        {showAccountManagement && <AccountManagement details={details} onClose={() => setIsAccountManagementVisible(false)} onConnect={handleConnect} />}
        {isDeclarationVisible && <Declaration onClose={() => setIsDeclarationVisible(false)} />}
        <span className={cn(styles.nav, 'relative bg-gradient-to-t', nav, 'translate-y-[10px]')} >
          <div className={cn(styles.gap, 'relative h-full grid grid-cols-[auto_auto_1fr] items-center justify-center')}>
            <div className="row-span-2 relative h-full" style={{ aspectRatio: '1720/785' }}>
              <Image src="/logo_white.png" loading="eager" fill alt="logo" sizes="30vw" className="object-contain" />
            </div>
            <div className="row-span-2 relative h-full" style={{ aspectRatio: '1192/368' }}>
              <Image src="/sign_white.png" loading="eager" fill alt="sign" sizes="40vw" className="object-contain" />
            </div>
            <span className={cn(styles.copyright, 'font-ibm')}>©2026 YororoIce. All code rights reserved.</span>
            <span className={styles.copyright}>本网站部分 UI 仿刻于游戏《明日方舟》，仅用于个人使用，不涉及任何商业用途</span>
          </div>

          {initialized && <div className={cn(styles.gap, 'relative h-full w-full flex items-center justify-end')} style={{ visibility: isConnecting ? 'hidden' : 'visible' }}>
            <Button size="small" onClick={() => setIsAccountManagementVisible(true)}>{'账号管理'}</Button>
            <Button size="small" onClick={() => setIsDeclarationVisible(true)}>{'查看声明'}</Button>
          </div>}
        </span>
      </div>
    </>
  );
}
