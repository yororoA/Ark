import Link from 'next/link';
import { INDEX_ENTRIES } from '../cover';
import styles from '../home.module.scss';

export default function IndexList() {
  return (
    <section className={styles.index} aria-label="模块">
      <div className={styles.indexHead}>
        <span>编号</span>
        <span>模块</span>
        <span>代码</span>
        <span>路径</span>
        <span>状态</span>
      </div>
      <ol>
        {INDEX_ENTRIES.map((entry) => {
          const current = entry.state === '当前';
          return (
            <li key={entry.no}>
              <Link
                className={styles.indexLink}
                href={entry.href}
                aria-current={current ? 'page' : undefined}
              >
                <span className={styles.indexNo}>{entry.no}</span>
                <span className={styles.indexLabel}>{entry.label}</span>
                <span className={styles.indexLatin}>{entry.latin}</span>
                <span className={styles.indexPath}>{entry.path}</span>
                <span className={current ? styles.stateOn : styles.stateOff}>{entry.state}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
