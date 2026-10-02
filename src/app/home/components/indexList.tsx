import Link from 'next/link';
import { INDEX_ENTRIES, STATE_LABEL } from '../cover';
import styles from '../home.module.scss';

export default function IndexList() {
  return (
    <ol className={styles.index}>
      {INDEX_ENTRIES.map((entry) => {
        const current = entry.state === 'CURRENT';
        return (
          <li key={entry.no} className={current ? styles.rowCurrent : styles.row}>
            <Link href={entry.href} aria-current={current ? 'page' : undefined}>
              <span className={styles.rowNo}>{entry.no}</span>
              <span className={styles.rowMain}>
                <span className={styles.rowLabel}>{entry.label}</span>
                <span className={styles.rowLatin}>{entry.latin}</span>
                <span className={styles.rowPath}>{entry.path}</span>
              </span>
              <span className={styles.rowState} data-state={entry.state}>
                {STATE_LABEL[entry.state]}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
