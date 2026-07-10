'use client'
import { useState, useMemo } from 'react'

import Button from "@/components/arks/button";
import styles from './login.module.scss';
import { cn } from '@/lib/utils';
import Image from "next/image";
import Declaration from "./components/declaration";
import Sphere from "@/components/arks/sphere";

export default function Login() {
  const nav = `from-[#3f3f3f]/99 from-60% to-[#3f3f3f]/80`
  const [isDeclarationVisible, setIsDeclarationVisible] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const SphereClassName = useMemo(() => isConnecting ?
    'translate-y-[0rem] scale-[0.7] transition-transform duration-[400ms]'
    : 'translate-y-[-17rem] scale-[1.2] transition-transform duration-[400ms]'
    , [isConnecting]);

  const handleConnect = () => {
    setIsConnecting(true)
  }

  return (
    <>
      <Sphere className={SphereClassName} color='rgba(255, 204, 0, 0.4)' edges={10} edgeWidth={'.3'} />
      <span className={cn(styles.nav, 'bg-gradient-to-b', nav)} />
      {!isConnecting && <>
        <div className={cn(styles.main, "relative w-full flex justify-center flex-1")}>
          <div className={cn(styles.bines_sign, 'absolute w-full pointer-events-none z-[0]')} style={{ aspectRatio: '16/8' }}>
            <Image src="/bines_sign.png" loading="eager" fill alt="logo" className="object-contain" />
          </div>
          <span className={cn(styles.pro_tag, 'font-batang z-[1]')}>{'YOROROICE ARK'}</span>
          <Button size="large" className="font-song z-[1]" onClick={handleConnect}>{'建立连接'}</Button>
          <div className={cn(styles.tag)}>
            <span className={cn(styles.tag_prefix, 'z-[1]')}>{'访客?'}</span>
            <span className={cn(styles.tag_suffix, 'relative z-[1]')}>{'YOROROICE ARK'}</span>
          </div>
        </div>
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
          <Button size="small" onClick={() => setIsDeclarationVisible(true)}>{'查看声明'}</Button>
        </div>}
      </span>
    </>
  );
}