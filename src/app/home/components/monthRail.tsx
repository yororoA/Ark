'use client'
import { useNow } from '@/hooks/useNow';
import { formatCoverDate } from '../cover';
import styles from '../home.module.scss';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const pad = (n: number) => String(n).padStart(2, '0');

export default function MonthRail() {
  const today = useNow();

  if (!today) return <footer className={styles.rail} />;

  const year = today.getFullYear();
  const month = today.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const current = today.getDate();

  return (
    <footer className={styles.rail} aria-label={`${year}年${month + 1}月`}>
      <span className={styles.railKey}>{MONTHS[month]}</span>
      <span className={styles.railNow}>{formatCoverDate(today)}</span>
      <ol className={styles.railTicks}>
        {Array.from({ length: days }, (_, i) => i + 1).map((day) => (
          <li
            key={day}
            className={day === current ? styles.tickToday : styles.tick}
            aria-current={day === current ? 'date' : undefined}
            title={`${month + 1}月${day}日`}
          >
            <span>{pad(day)}</span>
          </li>
        ))}
      </ol>
      <span className={styles.railNow}>{days} 日</span>
    </footer>
  );
}
