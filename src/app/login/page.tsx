'use client'
import { Suspense, useState, useMemo, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import Link from '@/components/appearance/p3r-link'
import { ArrowUpRight, BookOpen, CircleUserRound, ShieldCheck, UsersRound } from 'lucide-react'
import { useGetLocation } from '@/hooks/useGetLocation';
import { syncAuthDetails, useAuthStore } from '@/store/auth';

import styles from './login.module.scss';
import Declaration from "./components/declaration";
import AccountManagement, { type AccountFormIdentity } from "./components/accountManagement";
import ConnectionSequence, { type ConnectionState } from "./components/connectionSequence";
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import ArchiveLogo from '@/components/brand/archive-logo';
import ThemePicker from '@/components/appearance/theme-picker';
import RainPlanes from '@/components/appearance/rain-planes';
import P3RScene from '@/components/appearance/p3r-scene';
import PrismScene from '@/components/appearance/prism-scene';
import PrismStars from '@/components/appearance/prism-stars';
import AllotypeArt from '@/components/appearance/allotype-art';
import FoldArt from '@/components/appearance/fold-art';
import { useAppearance } from '@/components/appearance/appearance-store';
import { useRainConnection } from '@/components/appearance/rain-connection-store';
import { QINGJIAN_COPY } from '@/lib/qingjian-copy';
import type { Design } from '@/lib/appearance';
import type { ConnectParams } from './types';

function loginDestination(returnTo: string | null) {
  if (!returnTo?.startsWith('/') || returnTo.startsWith('//') || returnTo.includes('\\')) return '/home';
  try {
    const url = new URL(returnTo, 'https://ark.local');
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '');
    // Do not uncover another copy of the login page after successful access.
    if (url.origin !== 'https://ark.local' || !path || path === '/login') return '/home';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/home';
  }
}

function Login() {
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const returnTo = searchParams.get('returnTo');
  const destination = loginDestination(returnTo);
  const { design } = useAppearance();
  useEffect(() => {
    if (design === 'voyage') {
      void import('@/components/appearance/voyage-connection').catch(() => {});
      return;
    }
    if (design === 'fold') {
      void import('@/components/appearance/fold-connection').catch(() => {});
      return;
    }
    if (design === 'allotype') {
      void import('@/components/appearance/allotype-connection-sequence').catch(() => {});
      return;
    }
    if (design === 'prism') {
      void import('@/components/appearance/prism-connection-sequence').catch(() => {});
      return;
    }
    if (design === 'p3r') {
      void import('@/components/appearance/p3r-connection-sequence').catch(() => {});
      return;
    }
    if (design !== 'rain') return;
    void import('@/components/appearance/rain-connection-sequence').catch(() => {});
  }, [design]);
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
    void syncAuthDetails().catch(() => {});
  }, [ensureInitialized]);

  const [isDeclarationVisible, setIsDeclarationVisible] = useState(false);
  const [isAccountManagementVisible, setIsAccountManagementVisible] = useState(false);
  const [formIdentity, setFormIdentity] = useState<AccountFormIdentity | undefined>();
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [connectionDesign, setConnectionDesign] = useState<Design>('archive');
  const connectingRef = useRef(false);
  const requestIdRef = useRef(0);
  const isConnecting = connection !== null;
  // 首次登录强制打开账号管理，连接期间让位于所选主题的动效。
  const showAccountManagement = initialized && (details.length === 0 || isAccountManagementVisible) && !isConnecting;

  const { switchUser, register, login, guestLogin } = useAuth();
  const router = useRouter();
  // 连接按钮点击事件
  const handleConnect = async (params: ConnectParams) => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    // Retain only non-secret form fields for a failed attempt within this page.
    setFormIdentity(params.action === 'login' || params.action === 'register' ? {
      mode: params.action,
      username: params.username,
      ...(params.action === 'register' ? { email: params.email } : {}),
    } : undefined);
    const requestId = ++requestIdRef.current;
    let uid = params.action === 'switch' ? params.uid || details[0]?.uid || '' : '';
    const username = params.action === 'switch'
      ? details.find((detail) => detail.uid === uid)?.username || 'Guest'
      : params.action === 'guest' ? 'Guest' : params.username;

    const initial: ConnectionState = { status: 'pending', username };
    setConnectionDesign(design);
    setConnection(initial);
    setIsDeclarationVisible(false);
    const themedConnection = design === 'rain' || design === 'p3r' || design === 'prism' || design === 'allotype' || design === 'fold' || design === 'voyage';
    const rainId = themedConnection
      ? useRainConnection.getState().begin({ ...initial, design, destination, onDismiss: handleDismissConnection })
      : null;
    const updateConnection = (state: ConnectionState) => {
      setConnection(state);
      if (rainId !== null) useRainConnection.getState().update(rainId, state);
    };

    try {
      if (params.action === 'switch') await switchUser(uid);
      else if (params.action === 'guest') uid = (await guestLogin()).uid;
      else if (params.action === 'register') await register(params.username, params.password, params.email, params.code);
      else if (params.action === 'login') await login(params.username, params.password);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      updateConnection({
        status: 'error',
        username,
        error: err instanceof Error ? err.message : '连接失败，请稍后重试',
      });
      return;
    }

    if (requestId === requestIdRef.current) {
      setFormIdentity(undefined);
      const authenticated = useAuthStore.getState().details.find(detail =>
        params.action === 'switch' || params.action === 'guest' ? detail.uid === uid : detail.username === username
      );
      updateConnection({
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
    requestIdRef.current += 1;
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
      {connection && connectionDesign === 'archive' && (
        <ConnectionSequence
          {...connection}
          location={location ? `${location.continentCode}/${location.countryCode}` : '-- / --'}
          onComplete={handleConnected}
          onDismiss={handleDismissConnection}
        />
      )}
      {/* The previous dark sphere composition remains available in commit 26f4085. */}
      <div className={styles['login-scene']} inert={isConnecting || showAccountManagement || isDeclarationVisible}>
        <PrismStars />
        <P3RScene variant="login" />
        <PrismScene variant="login" />
        <header className={styles['login-header']}>
          <Link href="/home" aria-label="YororoIce Ark"><ArchiveLogo priority /></Link>
          <nav aria-label="登录页导航"><Link href="/home">浏览首页</Link><Link href="/terms">社区约定</Link><ThemePicker /></nav>
        </header>
        <main className={styles['login-main']}>
          <RainPlanes variant="identity" />
          <section className={styles['login-copy']}>
            <div className={styles['login-voyage']} aria-hidden="true">
              <div className={styles['voyage-plate-heading']}><span>ARK / NIGHT VOYAGE</span><span>继续阅读 ↗</span></div>
              <strong className={styles['voyage-plate-title']}>THE NEXT<br /><i>CHAPTER.</i></strong>
              <svg className={styles['voyage-plate-route']} viewBox="0 0 600 600" fill="none" preserveAspectRatio="none">
                <path d="M0 440H100C125 440 145 420 145 395V320C145 295 165 275 190 275H370C395 275 415 295 415 320V415C415 440 435 460 460 460H600" />
                <circle cx="145" cy="365" r="5" /><circle cx="310" cy="275" r="5" /><circle cx="500" cy="460" r="5" />
              </svg>
              <span className={styles['voyage-plate-origin']}>01 / 出发</span>
              <span className={styles['voyage-plate-caption']}>下一章，<br />从你开始。</span>
              <span className={styles['voyage-plate-reader']}>{activeAccount?.username || 'YOU ARE HERE'}<i>↗</i></span>
            </div>
            <div className={styles['login-fold']} aria-hidden="true">
              <div className={styles['fold-plate-heading']}><span>ARK / FIELD NOTES</span><span>06 — FOLD</span></div>
              <div className={styles['fold-portal']}>{design === 'fold' ? <FoldArt variant="portal" /> : null}</div>
              <div className={styles['fold-plate-caption']}><strong><span>ENTER</span><span>THE STORY.</span></strong><span>每一次抵达，<br />都是新的开始。</span></div>
            </div>
            <div className={styles['login-allotype']} aria-hidden="true"><span>HELLO,<br /><i>another you.</i></span>{design === 'allotype' ? <AllotypeArt index={3} /> : null}</div>
            <div className={styles['login-prism']} aria-hidden="true"><small>THE DARK SIDE OF THE MOON</small><span>THE OTHER<br />SIDE OF YOU.</span></div>
            <div className={styles['login-p3r']} aria-hidden="true"><span>CONTINUE</span><strong>YOUR STORY.</strong></div>
            <div className={styles['login-signature']} aria-hidden="true"><Image src="/bines_sign.png" alt="" fill sizes="300px" priority /></div>
            <div className={styles['login-rain']} aria-hidden="true">
              <span>{QINGJIAN_COPY.zh.name}</span><small>YOROROICE / ARK</small>
            </div>
            <div className={styles['login-eyebrow']}>IDENTITY ACCESS / 01</div>
            <h1><span className={styles['fold-login-heading']}>走进故事</span><span className={styles['standard-login-heading']}>身份验证</span></h1>
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
        {showAccountManagement && <AccountManagement details={details} preferredMode={mode} initialIdentity={formIdentity} onResetIdentity={() => setFormIdentity(undefined)} onClose={() => {
          setFormIdentity(undefined);
          setIsAccountManagementVisible(false);
        }} onConnect={handleConnect} />}
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
