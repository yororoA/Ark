'use client';
import Image from 'next/image';
import { useBrightness } from '@/context/brightness-context';
import { cn } from '@/lib/utils';
import MetaLine from './components/metaLine';
import IndexList from './components/indexList';
import MonthRail from './components/monthRail';
import RouteGate from './components/routeGate';
import { INDEX_ENTRIES, countState } from './cover';
import styles from './home.module.scss';

const summary = [
  { key: 'MODULES', label: '模块', value: INDEX_ENTRIES.length },
  { key: 'CURRENT', label: '当前', value: countState('CURRENT') },
  { key: 'STANDBY', label: '待命', value: countState('STANDBY') },
  { key: 'LOCKED', label: '锁定', value: countState('LOCKED') },
  { key: 'ARCHIVED', label: '归档', value: countState('ARCHIVED') },
  { key: 'OFFLINE', label: '离线', value: countState('OFFLINE') },
];

export default function Home() {
  const { isDimmed } = useBrightness();

  return (
    <>
      <RouteGate code="ARK / COVER · 01" />

      <main className={cn(styles.sheet, isDimmed && styles.sheetDim)}>
        <MetaLine />

        <section className={styles.ident}>
          <div>
            <p className={styles.identCode}>SYS / ARK</p>
            <h1 className={styles.identName}>封面索引</h1>
            <p className={styles.identEn}>MODULE / COVER</p>
          </div>
          <dl className={styles.stats}>
            {summary.map((item) => (
              <div key={item.key}>
                <dt>{item.label}<span>{item.key}</span></dt>
                <dd>{String(item.value).padStart(2, '0')}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.bay}>
          <div className={styles.bayHead}>
            <span>INDEX</span>
            <span>01–07</span>
          </div>

          <div className={styles.bayBody}>
            <IndexList />

            <article className={styles.record}>
              <p className={styles.recordFig}>FIG. 01</p>
              <div className={styles.recordWell}>
                <Image
                  src="/bines_sign.png"
                  alt="Bines 手写标记"
                  width={2304}
                  height={1728}
                  className={styles.recordImage}
                />
              </div>
              <div className={styles.recordCopy}>
                <p className={styles.recordCode}>ASSET / BINES-01</p>
                <h2>Bines</h2>
                <p className={styles.recordState}>在册</p>
              </div>
            </article>
          </div>

          <div className={styles.field} aria-hidden>
            <span className={styles.fieldMark}>X 00</span>
            <span className={styles.fieldMark}>Y 12</span>
            <p>
              <b>NO RECORD</b>
              本月尚无动态或文章。刻度停在本日。
            </p>
            <span className={styles.fieldMark}>GRID 48</span>
          </div>

          <MonthRail />
        </section>
      </main>
    </>
  );
}
