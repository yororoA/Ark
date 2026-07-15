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

export default function Login() {
  const location = useGetLocation(); // 用户ip定位
  const { setDimmed } = useBrightness(); // 登录页背景图亮度
  const ensureInitialized = useAuthStore((state) => state.ensureInitialized);

  useEffect(() => {
    ensureInitialized();
  }, [ensureInitialized]);

  const nav = `from-[#3f3f3f]/99 from-60% to-[#3f3f3f]/80`

  const [isDeclarationVisible, setIsDeclarationVisible] = useState(false);
  const [isAccountManagementVisible, setIsAccountManagementVisible] = useState(false);

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

  // 连接按钮点击事件
  const handleConnect = () => {
    setIsConnecting(true)
    setDimmed(true) // 登录页背景图变暗
    const intervalId = setInterval(() => {
      setProgress((prev) => {
        if (Number(prev.replace('%', '')) >= 100) {
          clearInterval(intervalId)
          return '100%'
        }
        return `${Number(prev.replace('%', '')) + 5}%`;
      })
    }, 100);
  }

  return (
    <>
      <Sphere className={SphereLargeClassName} color='rgba(34,211,238,.5)' edges={10} edgeWidth={2} dotRadius={3} />
      <Sphere className={cn(SphereSmallClassName, 'rotate-z-[90deg] rotate-x-[20deg]')} color="rgba(192,132,252,0.8)" edges={6} edgeWidth={2} dotRadius={3} />
      {isConnecting && <>
        <div className={cn(styles.connectionInfoCard)}>
          <span className='text-[.45rem] leading-[.45rem]'>{'接驳点'}</span>
          <span className='text-[1rem] font-song font-bold leading-[1.1rem]'>{location ? `${location?.continentCode}/${location?.countryCode}` : 'Unknown'}</span>
        </div>
        <span className={'absolute text-[.6rem] top-[78%] left-[50%] translate-x-[-50%] translate-y-[-50%] brightness-200'}>正在尝试与Bines Network&trade;进行认知同步</span>
        <Loading type="login" progress={progress} />
      </>}
      <span className={cn(styles.light)} />
      <span className={cn(styles.nav, 'bg-gradient-to-b', nav)} />
      {!isConnecting && <>
        <div className={cn(styles.main, "relative w-full flex justify-center flex-1")}>
          <div className={cn(styles.bines_sign, 'absolute w-full pointer-events-none z-[0]')} style={{ aspectRatio: '16/8' }}>
            <Image src="/bines_sign.png" loading="eager" fill alt="logo" className="object-contain" />
          </div>
          <span className={cn(styles.pro_tag, 'font-batang z-[1]')}>{'YOROROICE ARK'}</span>
          <Button size="large" className="font-song z-[1]" onClick={handleConnect} style={{ opacity: isAccountManagementVisible ? 0 : 1 }}>{'建立连接'}</Button>
          <div className={cn(styles.tag)} style={{ opacity: isAccountManagementVisible ? 0 : 1 }}>
            <span className={cn(styles.tag_prefix, 'z-[1]')}>{'访客?'}</span>
            <span className={cn(styles.tag_suffix, 'relative z-[1]')}>{'YOROROICE ARK'}</span>
          </div>
        </div>
        {isAccountManagementVisible && <AccountManagement onClose={() => setIsAccountManagementVisible(false)} />}
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
          <span className={styles.copyright}>本网站 UI 复刻于游戏《明日方舟》，仅用于个人使用，不涉及任何商业用途</span>
        </div>

        {!isConnecting && <div className={cn(styles.gap, 'relative h-full w-full flex items-center justify-end')}>
          <Button size="small" onClick={() => setIsAccountManagementVisible(true)}>{'账号管理'}</Button>
          <Button size="small" onClick={() => setIsDeclarationVisible(true)}>{'查看声明'}</Button>
        </div>}
      </span>
    </>
  );
}