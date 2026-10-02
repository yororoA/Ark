'use client';
import Image from 'next/image';
import { useBrightness } from '@/context/brightness-context';
import { cn } from '@/lib/utils';
import MetaLine from './components/metaLine';
import IndexList from './components/indexList';
import MonthRail from './components/monthRail';
import RouteGate from './components/routeGate';
import { INDEX_ENTRIES } from './cover';
import styles from './home.module.scss';

const mounted = INDEX_ENTRIES.filter((entry) => entry.state !== '未挂载').length;

export default function Home() {
  const { isDimmed } = useBrightness();

  return (
    <>
      <RouteGate code="ARK / COVER · 01" />

      <main className={cn(styles.sheet, isDimmed && styles.sheetDim)}>
        <MetaLine />

        <section className={styles.ident}>
          <div>
            <p className={styles.identCode}>SYS / ARK-COVER</p>
            <h1 className={styles.identName}>YororoIce Ark</h1>
          </div>
          <dl className={styles.stats}>
            <div>
              <dt>模块</dt>
              <dd>{String(INDEX_ENTRIES.length).padStart(2, '0')}</dd>
            </div>
            <div>
              <dt>在册</dt>
              <dd>{String(mounted).padStart(2, '0')}</dd>
            </div>
            <div>
              <dt>未挂载</dt>
              <dd>{String(INDEX_ENTRIES.length - mounted).padStart(2, '0')}</dd>
            </div>
          </dl>
          <p className={styles.log}>
            栏目路由未挂载。点开 02–07 会进入 404，再回到封面。
          </p>
        </section>

        <IndexList />

        <section className={styles.asset} aria-label="在册标记">
          <span className={styles.assetNo}>A1</span>
          <div className={styles.assetCopy}>
            <p className={styles.assetCode}>ASSET / BINES-01</p>
            <p className={styles.assetName}>Bines</p>
            <p className={styles.assetNote}>手写标记，在册。</p>
          </div>
          <div className={styles.assetWell}>
            <Image
              src="/bines_sign.png"
              alt="Bines 手写标记"
              width={2304}
              height={1728}
              className={styles.assetImage}
            />
          </div>
        </section>

        <MonthRail />
      </main>
    </>
  );
}
