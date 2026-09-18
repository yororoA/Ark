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

  const [isDeclarationVisible, setIsDeclarationVisible] = useState(false);
  const [isAccountManagementVisible, setIsAccountManagementVisible] = useState(false);
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const connectingRef = useRef(false);
  const requestIdRef = useRef(0);
  const isConnecting = connection !== null;
  // 首次登录强制打开账号管理，连接期间让位于终端动效。
  const showAccountManagement = initialized && (details.length === 0 || isAccountManagementVisible) && !isConnecting;

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
      const authenticated = useAuthStore.getState().details.find(detail =>
        params.action === 'switch' ? detail.uid === uid : detail.username === username
      );
      setConnection({
        status: 'success',
        username: authenticated?.username || username,
        role: authenticated?.isAdmin ? 'ADMINISTRATOR' : authenticated?.isGuest ? 'GUEST' : 'USER',
      });
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
      <div className={styles['login-scene']} inert={isConnecting || showAccountManagement || isDeclarationVisible}>
        {!isConnecting && <>
          <Sphere wrapperClassName={styles['idle-sphere-layer']} size="min(30rem, 92vw)" className={styles['idle-sphere']} color='rgba(34,211,238,.5)' edges={10} edgeWidth={2} dotRadius={3} />
          <Sphere wrapperClassName={styles['idle-sphere-layer']} size="min(30rem, 92vw)" className={cn(styles['idle-sphere'], styles['idle-sphere-secondary'])} color="rgba(192,132,252,0.8)" edges={6} edgeWidth={2} dotRadius={3} />
        </>}
        <div className={styles['top-band']} aria-hidden="true" />
        <main className={styles.main} style={{ visibility: isConnecting || showAccountManagement ? 'hidden' : 'visible' }}>
          <div className={styles['brand-mark']}>
            <Image src="/bines_sign.png" loading="eager" fill alt="Bines" sizes="(max-width: 600px) 90vw, 620px" className={styles['brand-image']} />
          </div>
          {initialized && <>
            <span className={cn(styles['project-tag'], 'font-batang')}>- YOROROIC ARK -</span>
            <Button size="large" className={cn(styles['connect-button'], 'font-song')} onClick={() => handleConnect({ action: 'switch' })}>建立连接</Button>
            <div className={styles['account-tag']}>
              <span className={styles['account-role']}>{details[0]?.isAdmin ? '管理员' : details[0]?.isGuest ? '访客' : '用户'}</span>
              <span className={styles['account-name']} title={details[0]?.username}>{details[0]?.username || 'Guest'}</span>
            </div>
          </>}
        </main>
        {showAccountManagement && <AccountManagement details={details} onClose={() => setIsAccountManagementVisible(false)} onConnect={handleConnect} />}
        {isDeclarationVisible && <Declaration onClose={() => setIsDeclarationVisible(false)} />}
        <footer className={styles.footer}>
          <div className={styles['footer-brands']}>
            <div className={styles['footer-logo']}>
              <Image src="/logo_white.png" loading="eager" fill alt="YororoIce" sizes="110px" className="object-contain" />
            </div>
            <div className={styles['footer-sign']}>
              <Image src="/sign_white.png" loading="eager" fill alt="山眠包" sizes="120px" className="object-contain" />
            </div>
          </div>
          <div className={styles.copyright}>
            <span className="font-ibm">©2026 YororoIce. All code rights reserved.</span>
            <span>本网站部分 UI 仿刻于游戏《明日方舟》，仅用于个人使用，不涉及任何商业用途</span>
          </div>
          {initialized && <div className={styles['footer-actions']} style={{ visibility: isConnecting ? 'hidden' : 'visible' }}>
            <Button size="small" onClick={() => setIsAccountManagementVisible(true)}>账号管理</Button>
            <Button size="small" onClick={() => setIsDeclarationVisible(true)}>查看声明</Button>
          </div>}
        </footer>
      </div>
    </>
  );
}
