'use client'
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthStore, type AuthDetail } from '@/store/auth';
import { useNow } from '@/hooks/useNow';
import { useBrightness } from '@/context/brightness-context';
import { GITHUB_USER } from '../cover';
import styles from '../home.module.scss';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const pad = (n: number) => String(n).padStart(2, '0');

function roleOf(detail?: AuthDetail) {
  if (!detail) return null;
  if (detail.isGuest) return '访客';
  return detail.isAdmin ? '管理员' : '用户';
}

export default function MetaLine() {
  const now = useNow();
  const [repos, setRepos] = useState<number | null>(null);
  const { isDimmed, setDimmed } = useBrightness();
  const ensureInitialized = useAuthStore((s) => s.ensureInitialized);
  const details = useAuthStore((s) => s.details);

  const current = useMemo(() => [...details].sort((a, b) =>
    (b.lastLoginAt || '').localeCompare(a.lastLoginAt || '')
  )[0], [details]);
  const role = roleOf(current);

  useEffect(() => {
    ensureInitialized();
  }, [ensureInitialized]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`https://api.github.com/users/${GITHUB_USER}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (typeof data?.public_repos === 'number') setRepos(data.public_repos);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const date = now ? `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}` : '----.--.--';
  const weekday = now ? WEEKDAYS[now.getDay()] : '---';
  const clock = now ? `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` : '--:--:--';

  return (
    <header className={styles.meta}>
      <span className={styles.metaKey}>ARK</span>
      <span className={styles.metaField}>{date}</span>
      <span className={styles.metaField}>{weekday}</span>
      <span className={styles.clock}>{clock}</span>
      <span className={styles.metaField}>
        <i className={role ? styles.dotOn : styles.dotOff} aria-hidden />
        {role ?? '未连接'}
      </span>
      <span className={styles.metaField}>
        {repos !== null ? (
          <a href={`https://github.com/${GITHUB_USER}`} target="_blank" rel="noreferrer">GH {repos}</a>
        ) : 'GH —'}
      </span>
      <button
        type="button"
        className={styles.metaCommand}
        aria-pressed={isDimmed}
        onClick={() => setDimmed(!isDimmed)}
      >
        {isDimmed ? '夜读' : '亮度'}
      </button>
      <Link className={styles.metaCommand} href="/login">账号</Link>
    </header>
  );
}
