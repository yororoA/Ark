'use client';
import { useEffect, useRef } from 'react';
import { useMouse } from '@/hooks/useMouse';
import styles from './home.module.scss';
import { Settings } from 'lucide-react';



export default function Home() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mouse = useMouse();
  const currentRotateY = useRef(0);
  const currentRotateX = useRef(0);

  useEffect(() => {
    let raf: number;

    const update = () => {
      const ratioX = (mouse.current.x - window.innerWidth / 2) / (window.innerWidth / 2);
      const targetRotateY = Math.max(-1, Math.min(1, ratioX)) * 10;
      const targetRotateX = -(mouse.current.y / window.innerHeight) * 2;

      // lerp 平滑插值，消除鼠标跟随的抖动感
      currentRotateY.current += (targetRotateY - currentRotateY.current) * 0.08;
      currentRotateX.current += (targetRotateX - currentRotateX.current) * 0.08;

      wrapRef.current!.style.transform =
        `rotateY(${currentRotateY.current}deg) rotateX(${currentRotateX.current}deg)`;

      raf = requestAnimationFrame(update);
    };

    raf = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className={styles.utils}>
        <Settings className='iconBtn_noBgd size-[2rem]' />
        <Settings className='iconBtn_noBgd size-[2rem]' />
        <Settings className='iconBtn_noBgd size-[2rem]' />
        <Settings className='iconBtn_noBgd size-[2rem]' />
      </div>

      <div className={styles.info}>
      </div>

      <div ref={wrapRef} className={styles.wrap}>
        <div className={styles.leftContents}>
          <div></div>
        </div>

        <div className={styles.rightContents}>
          <div></div>
        </div>
      </div>
    </>
  );
}