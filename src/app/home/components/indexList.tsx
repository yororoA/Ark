import Link from 'next/link';
import { INDEX_ENTRIES } from '../cover';
import styles from '../home.module.scss';

export default function IndexList() {
  return (
    <nav className={styles.index} aria-label="目录">
      <div className={styles.indexHead}>
        <span>目录</span>
        <span className={styles.latin}>CONTENTS</span>
      </div>
      <ol>
        {INDEX_ENTRIES.map((entry) => (
          <li key={entry.no}>
            <Link className={styles.indexLink} href={entry.href}>
              <span className={styles.indexNo}>{entry.no}</span>
              <span className={styles.indexLabel}>{entry.label}</span>
              <span className={styles.indexLatin}>{entry.latin}</span>
              <span className={styles.indexNote}>{entry.note}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
