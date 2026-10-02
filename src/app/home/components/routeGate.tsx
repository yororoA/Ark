'use client'
import { useEffect, useState } from 'react';
import styles from '../home.module.scss';

// 进场黑场：一拍之后硬切到纸面，不做淡出
const GATE_MS = 280;

export default function RouteGate({ code }: { code: string }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setOpen(false), GATE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!open) return null;

  return (
    <div className={styles.gate} aria-hidden>
      <span>{code}</span>
    </div>
  );
}
