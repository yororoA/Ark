'use client'
import { useState, useMemo, useEffect } from 'react'
import { useGetLocation } from '@/hooks/useGetLocation';
import { useBrightness } from '@/context/brightness-context';
import { useAuthStore } from '@/store/auth';

import Button from "@/components/arks/button";
import styles from './login.module.scss';
import { cn } from '@/lib/utils';
import Image from "next/image";
import Declaration from "./components/declaration";
import AccountManagement from "./components/accountManagement";
import Sphere from "@/components/arks/sphere";
import Loading from "@/components/arks/loading";
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

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
  // 无登录记录时强制打开账号管理（无法关闭）；有记录时按用户操作
  const showAccountManagement = initialized && (details.length === 0 || isAccountManagementVisible);

  const [isConnecting, setIsConnecting] = useState(false);

  // 球
  const SphereLargeClassName = useMemo(() => isConnecting ?
    'translate-y-[0rem] scale-[0.7] transition-transform duration-[400ms] opacity-[1] '
    : 'translate-y-[-17rem] scale-[1.2] transition-transform duration-[400ms] opacity-[0.5]'
    , [isConnecting]);
  const SphereSmallClassName = useMemo(() => isConnecting ?
    'translate-y-[0rem] scale-[0.8] transition-transform duration-[400ms] opacity-[1]'
    : 'translate-y-[-17rem] scale-[1.2] transition-transform duration-[400ms] opacity-[0.5]'
    , [isConnecting]);

  // 连接进度
  const [progress, setProgress] = useState('0%')

  const { switchUser, register, login } = useAuth();
  const router = useRouter();
  // 连接按钮点击事件
  const handleConnect = async (s?: 'switch' | 'register' | 'login', username?: string, uid?: string, password?: string, email?: string, code?: string) => {
    setIsConnecting(true)
    setDimmed(true) // 登录页背景图变暗
    let intervalId: ReturnType<typeof setInterval> | undefined;
    intervalId = setInterval(() => {
      setProgress((prev) => {
        if (Number(prev.replace('%', '')) >= 80) {
          clearInterval(intervalId);
          intervalId = undefined;
          return '80%'
        }
        const next = Number(prev.replace('%', '')) + Math.floor(Math.random() * 15);
        return `${next >= 80 ? 80 : next}%`;
      })
    }, 100);

    // 先让动画稳定播放（progress 推进到 80%），再执行 Server Action。
    // 关键：避免 Server Action 中 cookies().set() 触发的 RSC refresh 打断正在运行的动画。
    // await new Promise<void>((resolve) => setTimeout(resolve, 800));

    try {
      if (s === 'switch') await switchUser(uid || details[0]?.uid || '');
      else if (s === 'register') await register(username || '', password || '', email || '', code || '');
      else if (s === 'login') await login(username || '', password || '');
    } catch (err) {
      console.log(err);
      if (intervalId) clearInterval(intervalId);
      setProgress('0%');
      setDimmed(false);
      setIsConnecting(false);
      return;
    }
    // 防御性清理（progress 到 80% 时 setInterval 已自清除，但 Server Action 可能在 800ms 内已完成 round-trip 之前的极端情况）
    if (intervalId) clearInterval(intervalId);
    setProgress('100%');
  }

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (progress === '100%') {
      timeoutId = setTimeout(() => {
        setDimmed(false); // context state，需在跳转前重置，否则首页 BgImage 仍是暗的
        // 用户回退时直接返回来源页而非再次进入 login
        router.replace('/');
      }, 1000);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }, [progress, router, setDimmed]);

  // 兜底：组件 unmount 时确保 isDimmed 重置。
  // 防止 router.replace 的 navigation 太快（首页已缓存）导致 setTimeout 里的
  // setDimmed(false) 被 navigation 打断没来得及 commit，首页 BgImage 仍是暗的。
  useEffect(() => {
    return () => {
      setDimmed(false);
    };
  }, [setDimmed]);

  return (
    <>
      <Sphere className={SphereLargeClassName} color='rgba(34,211,238,.5)' edges={10} edgeWidth={2} dotRadius={3} />
      <Sphere className={cn(SphereSmallClassName, 'rotate-z-[90deg] rotate-x-[20deg]')} color="rgba(192,132,252,0.8)" edges={6} edgeWidth={2} dotRadius={3} />
      {<>
        <div className={cn(styles.connectionInfoCard)} style={{ visibility: isConnecting ? 'visible' : 'hidden' }}>
          <span className='text-[.45rem] leading-[.45rem]'>{'接驳点'}</span>
          <span className='text-[1rem] font-song font-bold leading-[1.1rem]'>{location ? `${location?.continentCode}/${location?.countryCode}` : 'Unknown'}</span>
        </div>
        <span style={{ visibility: isConnecting ? 'visible' : 'hidden' }} className={'absolute text-[.6rem] top-[78%] left-[50%] translate-x-[-50%] translate-y-[-50%] brightness-200'}>正在尝试与Bines Network&trade;进行认知同步</span>
        <Loading style={{ visibility: isConnecting ? 'visible' : 'hidden' }} type="login" progress={progress} />
      </>}
      <span className={cn(styles.light)} />
      <span className={cn(styles.nav, 'bg-gradient-to-b', nav)} />
      {<>
        <div className={cn(styles.main, "relative w-full flex justify-center flex-1")} style={{ opacity: showAccountManagement ? 0 : 1, visibility: isConnecting ? 'hidden' : 'visible', pointerEvents: showAccountManagement || isConnecting ? 'none' : 'auto' }}>
          <div className={cn(styles.bines_sign, 'absolute w-full pointer-events-none z-[0]')} style={{ aspectRatio: '16/8' }}>
            <Image src="/bines_sign.png" loading="eager" fill alt="logo" className="object-contain" />
          </div>
          {initialized && <>
            <span className={cn(styles.pro_tag, 'font-batang z-[1]')}>{'YOROROICE ARK'}</span>
            <Button size="large" className="font-song z-[1]" onClick={() => handleConnect('switch')}>{'建立连接'}</Button>
            <div className={cn(styles.tag)}>
              <span className={cn(styles.tag_prefix, 'z-[1]')}>{details[0]?.isAdmin ? '管理员' : details[0]?.isGuest ? '访客' : '用户'}</span>
              <span className={cn(styles.tag_suffix, 'relative z-[1]')}>{details[0]?.username}</span>
            </div>
          </>}
        </div>
        {showAccountManagement && <AccountManagement details={details} onClose={() => setIsAccountManagementVisible(false)} onConnect={handleConnect} />}
        {isDeclarationVisible && <Declaration onClose={() => setIsDeclarationVisible(false)} />}
      </>}
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
    </>
  );
}
