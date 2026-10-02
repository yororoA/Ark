import Image from 'next/image';
import Link from 'next/link';
import { INDEX_ENTRIES, STATE_LABEL, type ModuleState } from '../cover';
import styles from '../home.module.scss';

export default function IndexList({ filter }: { filter: ModuleState | null }) {
  return (
    <ol className={styles.index}>
      {INDEX_ENTRIES.map((entry) => {
        const current = entry.state === 'CURRENT';
        const dim = filter !== null && entry.state !== filter;
        return (
          <li
            key={entry.no}
            className={current ? styles.rowCurrent : styles.row}
            data-dim={dim}
            data-hit={filter === entry.state}
          >
            <Link href={entry.href} aria-current={current ? 'page' : undefined}>
              <span className={current ? styles.displayNo : styles.rowNo}>{entry.no}</span>
              <span className={styles.rowMain}>
                <span className={styles.rowLabel}>{entry.label}</span>
                <span className={styles.rowLatin}>{entry.latin}</span>
                <span className={styles.rowMeta}>{entry.kind} · {entry.access} · {entry.updated}</span>
                <span className={styles.rowPath}>{entry.path}</span>
              </span>
              <span className={styles.rowState} data-state={entry.state}>
                {STATE_LABEL[entry.state]}
              </span>
            </Link>
            {current && (
              <div className={styles.node}>
                <span className={styles.nodeFig}>FIG.01</span>
                <div>
                  <p className={styles.nodeCode}>BINES-01</p>
                  <p className={styles.nodeLine}>TYPE / MARK</p>
                  <p className={styles.nodeLine}>ARCHIVE / PERSONAL</p>
                  <p className={styles.nodeCursor}>在册</p>
                </div>
                <div className={styles.nodePreview}>
                  <Image src="/bines_sign.png" alt="Bines 手写标记" width={2304} height={1728} />
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
