'use client'
import { Suspense, useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, BookOpen, CircleUserRound, ShieldCheck, UsersRound } from 'lucide-react'
import { useGetLocation } from '@/hooks/useGetLocation';
import { useAuthStore } from '@/store/auth';

import styles from './login.module.scss';
import Declaration from "./components/declaration";
import AccountManagement from "./components/accountManagement";
import ConnectionSequence, { type ConnectionState } from "./components/connectionSequence";
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import ArchiveLogo from '@/components/brand/archive-logo';
import ThemePicker from '@/components/appearance/theme-picker';
import type { ConnectParams } from './types';

function Login() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const returnTo = searchParams.get('returnTo');
  const destination = returnTo?.startsWith('/') && !returnTo.startsWith('//') && !returnTo.includes('\\') ? returnTo : '/home';
  const location = useGetLocation(); // 用户ip定位
  const ensureInitialized = useAuthStore((state) => state.ensureInitialized);
  const initialized = useAuthStore((state) => state.initialized);
  const rawDetails = useAuthStore((state) => {
    return state.details
  });
  // 按最后登录时间排序，最新在最前面
  const details = useMemo(() => [...rawDetails].sort((a, b) =>
    b.lastLoginAt?.localeCompare(a.lastLoginAt || '') || 0
  ), [rawDetails]);
  const activeAccount = details[0];
  const activeRole = activeAccount?.isAdmin ? 'ADMIN' : activeAccount?.isGuest ? 'GUEST' : 'USER';
  const activeRoleLabel = activeAccount?.isAdmin ? '管理员' : activeAccount?.isGuest ? '游客' : '用户';
  const locationLabel = location ? `${location.continentCode || '--'} / ${location.countryCode || '--'}` : '-- / --';

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

  const { switchUser, register, login, guestLogin } = useAuth();
  const router = useRouter();
  // 连接按钮点击事件
  const handleConnect = async (params: ConnectParams) => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    const requestId = ++requestIdRef.current;
    let uid = params.action === 'switch' ? params.uid || details[0]?.uid || '' : '';
    const username = params.action === 'switch'
      ? details.find((detail) => detail.uid === uid)?.username || 'Guest'
      : params.action === 'guest' ? 'Guest' : params.username;

    setConnection({ status: 'pending', username });
    setIsDeclarationVisible(false);

    try {
      if (params.action === 'switch') await switchUser(uid);
      else if (params.action === 'guest') uid = (await guestLogin()).uid;
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
        params.action === 'switch' || params.action === 'guest' ? detail.uid === uid : detail.username === username
      );
      setConnection({
        status: 'success',
        username: authenticated?.username || username,
        role: authenticated?.isAdmin ? 'ADMINISTRATOR' : authenticated?.isGuest ? 'GUEST' : 'USER',
      });
    }
  }

  const handleConnected = useCallback(() => {
    router.replace(destination);
  }, [router, destination]);

  const handleDismissConnection = useCallback(() => {
    connectingRef.current = false;
    setConnection(null);
    setIsAccountManagementVisible(true);
  }, []);

  // Ignore late responses after navigation.
  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

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
      {/* The previous dark sphere composition remains available in commit 26f4085. */}
      <div className={styles['login-scene']} inert={isConnecting || showAccountManagement || isDeclarationVisible}>
        <header className={styles['login-header']}>
          <Link href="/home" aria-label="YororoIce Ark"><ArchiveLogo priority /></Link>
          <nav aria-label="登录页导航"><Link href="/home">浏览首页</Link><Link href="/terms">社区约定</Link><ThemePicker /></nav>
        </header>
        <main className={styles['login-main']}>
          <section className={styles['login-copy']}>
            <div className={styles['login-signature']} aria-hidden="true"><Image src="/bines_sign.png" alt="" fill sizes="300px" priority /></div>
            <div className={styles['login-rain']} aria-hidden="true">
              <span>雨声</span>
              <svg viewBox="0 0 200 150" fill="none"><path d="M50 90V58C50 5 150 5 150 58V90M65 85V58C65 20 135 20 135 58V85M100 5V18" stroke="currentColor" strokeWidth=".7" /><ellipse cx="100" cy="121" rx="42" ry="7" stroke="currentColor" /><ellipse cx="100" cy="121" rx="72" ry="16" stroke="currentColor" opacity=".4" /></svg>
            </div>
            <div className={styles['login-eyebrow']}>IDENTITY ACCESS / 01</div>
            <h1>身份验证</h1>
            <p>登录已有账号、注册新身份，或以游客身份继续访问。</p>
            <div className={styles['access-notes']}><span><ShieldCheck size={15} />安全会话</span><span><BookOpen size={15} />保留原有内容</span></div>
            <dl className={styles['archive-register']}>
              <div><dt>ARCHIVE NODE</dt><dd>YOROROICE / 01</dd></div>
              <div><dt>SESSION</dt><dd>{initialized ? 'READY' : 'SYNC'}</dd></div>
              <div><dt>LOCATION</dt><dd>{locationLabel}</dd></div>
            </dl>
          </section>
          <section className={styles['access-panel']} aria-label="当前账号">
            <div className={styles['panel-header']}><div className={styles['panel-index']}>当前身份 / 01</div><span className={styles['panel-signal']} data-ready={initialized}><i />{initialized ? 'READY' : 'SYNC'}</span></div>
            <div className={styles['account-overview']}>
              <div className={styles['account-glyph']}><CircleUserRound size={27} strokeWidth={1} /></div>
              <div className={styles['active-account']}>
                <small>{activeRoleLabel}</small>
                <strong title={activeAccount?.username}>{activeAccount?.username || '未选择账号'}</strong>
                <span>{activeAccount ? '凭据将在服务端重新验证' : '选择一种方式接入个人档案'}</span>
              </div>
            </div>
            <div className={styles['credential-status']}>
              <div><span>ACCOUNT RECORD</span><strong>{String(details.length).padStart(2, '0')}</strong></div>
              <div><span>ACCESS LEVEL</span><strong>{activeAccount ? activeRole : '--'}</strong></div>
            </div>
            {activeAccount ? <>
              <button className={styles['primary-action']} disabled={!initialized} onClick={() => handleConnect({ action: 'switch' })}>建立连接<ArrowUpRight size={17} /></button>
              <button className={styles['secondary-action']} onClick={() => setIsAccountManagementVisible(true)}><UsersRound size={14} />管理账号</button>
            </> : <button className={styles['primary-action']} onClick={() => setIsAccountManagementVisible(true)}>登录 / 注册<ArrowUpRight size={17} /></button>}
          </section>
        </main>
        {showAccountManagement && <AccountManagement details={details} preferredMode={mode} onClose={() => setIsAccountManagementVisible(false)} onConnect={handleConnect} />}
        {isDeclarationVisible && <Declaration onClose={() => setIsDeclarationVisible(false)} />}
        <footer className={styles['login-footer']}>
          <span>© 2026 YOROROICE / PERSONAL ARCHIVE</span>
          <button onClick={() => setIsDeclarationVisible(true)}>版权与设计声明</button>
          <span>LOCATION / {locationLabel}</span>
        </footer>
      </div>
    </>
  );
}

export default function Page() {
  return <Suspense><Login /></Suspense>;
}
