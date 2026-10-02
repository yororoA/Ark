'use client'
import { useNow } from '@/hooks/useNow';
import styles from '../home.module.scss';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export default function MonthRail() {
  const today = useNow();

  if (!today) return <footer className={styles.rail} />;

  const year = today.getFullYear();
  const month = today.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const current = today.getDate();

  return (
    <footer className={styles.rail}>
      <span className={styles.railLabel}>
        {month + 1}月 <span className={styles.latin}>{MONTHS[month]}</span>
      </span>
      <ol className={styles.railTicks} aria-label={`${month + 1}月日历`}>
        {Array.from({ length: days }, (_, i) => i + 1).map((day) => (
          <li
            key={day}
            className={day === current ? styles.tickToday : day % 5 === 0 ? styles.tickMajor : styles.tick}
            aria-current={day === current ? 'date' : undefined}
          >
            {(day === current || day % 5 === 0) && <span>{String(day).padStart(2, '0')}</span>}
          </li>
        ))}
      </ol>
      <span className={styles.railLabel}>© YororoIce</span>
    </footer>
  );
}
