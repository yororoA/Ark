'use client';
import { useState } from 'react';
import { useBrightness } from '@/context/brightness-context';
import { cn } from '@/lib/utils';
import MetaLine from './components/metaLine';
import IndexList from './components/indexList';
import MonthRail from './components/monthRail';
import RouteGate from './components/routeGate';
import { INDEX_ENTRIES, countState, GRID_X, GRID_Y, type ModuleState } from './cover';
import styles from './home.module.scss';

const summary: { key: string; label: string; state: ModuleState | null; value: number }[] = [
  { key: 'MODULES', label: '模块', state: null, value: INDEX_ENTRIES.length },
  { key: 'CURRENT', label: '当前', state: 'CURRENT', value: countState('CURRENT') },
  { key: 'STANDBY', label: '待命', state: 'STANDBY', value: countState('STANDBY') },
  { key: 'LOCKED', label: '锁定', state: 'LOCKED', value: countState('LOCKED') },
  { key: 'ARCHIVED', label: '归档', state: 'ARCHIVED', value: countState('ARCHIVED') },
  { key: 'OFFLINE', label: '离线', state: 'OFFLINE', value: countState('OFFLINE') },
];

export default function Home() {
  const { isDimmed } = useBrightness();
  const [filter, setFilter] = useState<ModuleState | null>(null);

  return (
    <>
      <RouteGate code="ARK / COVER · 01" />

      <main className={cn(styles.sheet, isDimmed && styles.sheetDim)}>
        <MetaLine />

        <section className={styles.ident}>
          <div>
            <p className={styles.identCode}>SYS / ARK</p>
            <p className={styles.identNo}>01</p>
            <h1 className={styles.identName}>封面</h1>
            <p className={styles.identEn}>COVER</p>
          </div>
          <div className={styles.stats}>
            {summary.map((item) => (
              <button
                key={item.key}
                type="button"
                className={styles.stat}
                data-cursor={item.state === 'CURRENT'}
                aria-pressed={item.state !== null && filter === item.state}
                onClick={() => setFilter(item.state === null || filter === item.state ? null : item.state)}
              >
                <span className={styles.statLabel}>{item.label}<span>{item.key}</span></span>
                <span className={styles.statValue}>{String(item.value).padStart(2, '0')}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.bay}>
          <div className={styles.bayHead}>
            <span>ARCHIVE</span>
            <span>{filter ? summary.find((item) => item.state === filter)?.key : '01–07'}</span>
          </div>

          <IndexList filter={filter} />

          <div className={styles.field}>
            <div className={styles.activity}>
              <p>ARCHIVE ACTIVITY</p>
              <strong>NO RECORD</strong>
              <span>本月无新增记录。黄刻度与顶栏是同一天。</span>
            </div>
            <div className={styles.plot} aria-label="模块坐标">
              {INDEX_ENTRIES.map((entry) => {
                const dim = filter !== null && entry.state !== filter;
                return (
                  <span
                    key={entry.no}
                    className={styles.dot}
                    data-current={entry.state === 'CURRENT'}
                    data-dim={dim}
                    style={{ left: `${(entry.x / GRID_X) * 100}%`, top: `${(entry.y / GRID_Y) * 100}%` }}
                  >
                    {entry.no}
                  </span>
                );
              })}
            </div>
          </div>

          <MonthRail />
        </section>
      </main>
    </>
  );
}
