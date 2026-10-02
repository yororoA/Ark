'use client';
import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useMouse } from '@/hooks/useMouse';
import { useBrightness } from '@/context/brightness-context';
import { cn } from '@/lib/utils';
import MetaLine from './components/metaLine';
import IndexList from './components/indexList';
import MonthRail from './components/monthRail';
import RouteGate from './components/routeGate';
import { EDITOR_NOTE } from './cover';
import styles from './home.module.scss';

export default function Home() {
  const mastheadRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLElement>(null);
  const mouse = useMouse();
  const { isDimmed } = useBrightness();

  // 刊名和标志框按鼠标做几像素的反向位移，只给细指针、未要求减弱动效的设备
  useEffect(() => {
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reduced) return;

    let raf: number;
    let x = 0;
    let y = 0;

    const update = () => {
      const ratioX = Math.max(-1, Math.min(1, (mouse.current.x - window.innerWidth / 2) / (window.innerWidth / 2)));
      const ratioY = Math.max(-1, Math.min(1, (mouse.current.y - window.innerHeight / 2) / (window.innerHeight / 2)));
      x += (ratioX - x) * 0.08;
      y += (ratioY - y) * 0.08;

      if (mastheadRef.current) mastheadRef.current.style.transform = `translate3d(${x * -8}px, ${y * -4}px, 0)`;
      if (frameRef.current) frameRef.current.style.transform = `translate3d(${x * 5}px, ${y * 3}px, 0)`;

      raf = requestAnimationFrame(update);
    };

    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [mouse]);

  return (
    <>
      <RouteGate code="YORORO ARK / COVER · 01" />

      <main className={cn(styles.sheet, isDimmed && styles.sheetDim)}>
        <MetaLine />

        <section className={styles.masthead}>
          <div ref={mastheadRef} className={styles.mastheadInner}>
            <h1 className={styles.title}>
              YORORO
              <span className={styles.titleCn}>冰</span>
            </h1>
            <div className={styles.subline}>
              <span className={styles.spaced}>YORORO ICE · ARK</span>
              <span className={styles.hairline} aria-hidden />
              <span className={styles.metaDim}>个人刊物</span>
            </div>
          </div>
        </section>

        <section className={styles.body}>
          <div className={styles.slab} aria-hidden />
          <svg className={styles.cut} aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="9" y1="0" x2="0" y2="100" stroke="#0098c8" strokeWidth="4" vectorEffect="non-scaling-stroke" />
          </svg>
          <article className={styles.feature}>
            <span className={styles.kicker}>
              <i aria-hidden />
              {EDITOR_NOTE.kicker}
            </span>
            <h2 className={styles.featureTitle}>{EDITOR_NOTE.title}</h2>
            <p className={styles.featureBody}>{EDITOR_NOTE.body}</p>
            <Link className={styles.featureLink} href={EDITOR_NOTE.href}>
              {EDITOR_NOTE.linkLabel}
              <span aria-hidden>→</span>
            </Link>
          </article>

          <div className={styles.dock}>
            <Image
              src="/logo.png"
              alt="YororoIce 签名"
              width={1720}
              height={785}
              loading="eager"
              className={styles.signature}
            />
            <div className={styles.dockRow}>
              <IndexList />
              <figure ref={frameRef} className={styles.frame}>
                <div className={styles.frameCut}>
                  <Image
                    src="/bines_sign.png"
                    alt="Bines"
                    width={2304}
                    height={1728}
                    className={styles.frameImage}
                  />
                </div>
                <figcaption className={styles.frameCaption}>
                  <span className={styles.mono}>FIG. 01</span>
                  <span>Bines</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <MonthRail />

        <span className={styles.spine} aria-hidden>封面 · COVER</span>
      </main>
    </>
  );
}
