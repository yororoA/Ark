import { useMemo } from "react";
import styles from './loading.module.scss';
import Portal from '@/components/Portal'
import { cn } from '@/lib/utils'

export type LoadingProps = {
  type: 'charJump' | 'text' | 'animation' | 'login'
  text?: string
  progress?: string
  style?: React.CSSProperties
}

export default function Loading(props: LoadingProps) {
  const textChars = useMemo(() => {
    switch (props.type) {
      case 'charJump':
        return CharJump({ text: props.text! })
      case 'text':
        return props.text!
      case 'animation':
        return Animation({ text: props.text! })
      case 'login':
        return LoginLoading({ progresss: props.progress })
      default:
        return props.text || ''
    }
  }, [props]);

  return (
    <Portal black={props.type !== 'login'} style={props.style}>
      <div className={styles.wrap}>
        {textChars}
      </div>
    </Portal>
  );
}

function CharJump(props: { text: string }) {
  const JUMP_DURATION = 0.1;

  return props.text
    .split('')
    .map((char, index) => {
      // 总时长 = 字符数 × 单个周期，让字符依次弹跳
      const totalDuration = props.text.length * JUMP_DURATION;
      // 错开启动时间
      const delay = index * JUMP_DURATION;

      return (
        <span key={`${char}-${index}`} className={styles.charJump}
          style={{
            '--charJumpDuration': `${totalDuration}s`,
            '--charJumpDelay': `${delay}s`
          }}
        >{char}</span>
      );
    })
}

function Animation(props: { text: string }) {
  return (
    <div className={cn(styles.animation, "self-end flex items-center justify-center bg-black/20 backdrop-blur-md")}>
      <span className={cn(styles.animationIcon, "relative")} >
        <span className={cn(styles.animationText, "absolute left-full top-1/2 -translate-y-1/2 whitespace-nowrap")}>{props.text}</span>
      </span>
    </div>
  )
}

function LoginLoading(props: { progresss?: string }) {
  const progress = props.progresss || '0%'

  return (
    <div className={styles.login}>
      <span className={cn(styles.loginBar)} style={{ '--loginBarWidth': progress }} >{progress !== '100%' && progress}</span>
      <span className={cn(styles.loginBar)} style={{ '--loginBarWidth': progress }} >{progress !== '100%' && progress}</span>
    </div>
  )
}