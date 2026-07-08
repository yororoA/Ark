import Button from "@/components/arks/button";
import styles from './nav.module.scss';
import { cn } from '@/lib/utils';
import Image from "next/image";

export default function Login() {
  const nav = `from-[#3f3f3f]/99 from-60% to-[#3f3f3f]/80`

  return (
    <>
      <span className={cn(styles.nav, 'bg-gradient-to-b', nav)} />
      <Button size="large">{'开始唤醒'}</Button>
      <span className={cn(styles.nav, 'relative bg-gradient-to-t', nav)} >
        <div className={cn(styles.gap, 'relative h-full grid grid-cols-[auto_auto_1fr] items-center justify-center')}>
          <div className="row-span-2 relative h-full" style={{ aspectRatio: '1720/785' }}>
            <Image src="/logo_white.png" fill alt="logo" className="object-contain" />
          </div>
          <div className="row-span-2 relative h-full" style={{ aspectRatio: '1192/368' }}>
            <Image src="/sign_white.png" fill alt="sign" className="object-contain" />
          </div>
          <span className={styles.copyright}>&copy; YororoIce. All code rights reserved.</span>
          <span className={styles.copyright}>本网站 UI 复刻于游戏《明日方舟》，仅用于个人使用，不涉及任何商业用途</span>

        </div>

        <div className={cn(styles.gap, 'relative h-full w-full flex items-center justify-end')}>
          <Button size="small">{'登录2'}</Button>
          <Button size="small">{'查看公告'}</Button>
        </div>
      </span>
    </>
  );
}