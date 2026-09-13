'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowLeft, Check, LoaderCircle, ShieldCheck, TriangleAlert } from 'lucide-react';
import Portal from '@/components/Portal';
import styles from './connectionSequence.module.scss';

export interface ConnectionState {
  status: 'pending' | 'success' | 'error';
  username: string;
  error?: string;
}

interface ConnectionSequenceProps extends ConnectionState {
  location: string;
  onComplete: () => void;
  onDismiss: () => void;
}

const MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const TIMING = {
  terminal: 1900,
  introComplete: 3400,
  success: 650,
  exit: 700,
};

function subscribeToMotion(onChange: () => void) {
  const media = window.matchMedia(MOTION_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

export default function ConnectionSequence({
  status,
  username,
  error,
  location,
  onComplete,
  onDismiss,
}: ConnectionSequenceProps) {
  const reducedMotion = useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  );
  const [stage, setStage] = useState<'boot' | 'terminal' | 'exit'>('boot');
  const [introComplete, setIntroComplete] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const terminal = window.setTimeout(() => setStage('terminal'), reducedMotion ? 0 : TIMING.terminal);
    const ready = window.setTimeout(() => setIntroComplete(true), reducedMotion ? 0 : TIMING.introComplete);
    return () => {
      window.clearTimeout(terminal);
      window.clearTimeout(ready);
    };
  }, [reducedMotion]);

  useEffect(() => {
    // Both the visual introduction and the real authentication must finish.
    if (!introComplete || status !== 'success') return;
    const hold = reducedMotion ? 120 : TIMING.success;
    const exit = window.setTimeout(() => setStage('exit'), hold);
    const complete = window.setTimeout(onComplete, hold + (reducedMotion ? 120 : TIMING.exit));
    return () => {
      window.clearTimeout(exit);
      window.clearTimeout(complete);
    };
  }, [introComplete, status, reducedMotion, onComplete]);

  const phase = status === 'error' ? 'error'
    : stage === 'exit' ? 'exit'
      : introComplete && status === 'success' ? 'success' : stage;
  const verified = phase === 'success' || phase === 'exit';
  const failed = phase === 'error';
  const statusText = failed ? '连接未完成' : verified ? '身份认证通过' : '正在进行身份认证';

  return (
    <Portal black={false}>
      <section
        ref={dialogRef}
        className={styles.sequence}
        data-phase={phase}
        data-testid="connection-sequence"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-label="PRTS 连接终端"
        aria-busy={status === 'pending'}
      >
        <div className={styles['boot-stage']} aria-hidden="true">
          <div className={styles['boot-meta']}>
            <span>PRTS / CONNECTION REQUEST</span>
            <span>YOROROICE ARK</span>
          </div>
          <div className={styles['lock-on']}>
            <div className={styles['signal-rail']} />
            <div className={styles['outer-frame']} />
            <div className={styles['inner-frame']} />
            <div className={styles['boot-brand']}>
              <span>YOROROICE</span>
              <strong>ARK</strong>
              <span>TERMINAL CONNECTION</span>
            </div>
            <span className={styles['signal-code']}>BINES / NETWORK</span>
          </div>
          <div className={styles['boot-caption']}>
            <span className={styles['signal-dot']} />
            ESTABLISHING CONNECTION
          </div>
        </div>

        <div className={styles['terminal-stage']} aria-hidden={phase === 'boot'}>
          <header className={styles['terminal-header']}>
            <span><span className={styles['square-mark']} /> BINES NETWORK</span>
            <span>PRTS / 01</span>
          </header>

          <div className={styles['terminal-content']}>
            <span className={styles['corner-mark']} aria-hidden="true" />
            <span className={styles['corner-mark']} aria-hidden="true" />
            <span className={styles['corner-mark']} aria-hidden="true" />
            <span className={styles['corner-mark']} aria-hidden="true" />

            <div className={styles['terminal-brand']}>
              <h1>PRTS</h1>
              <strong>YOROROICE ARK</strong>
              <span>TERMINAL SERVICE</span>
            </div>
            <div className={styles.divider} aria-hidden="true" />
            <div className={styles['identity-panel']}>
              <div className={styles['identity-field']}>
                <span className={styles['field-label']}>USER NAME</span>
                <span className={styles['field-value']} title={username}>{username}</span>
              </div>
              <div className={styles['identity-field']}>
                <span className={styles['field-label']}>AUTHENTICATION</span>
                <div className={styles['auth-status']}>
                  {failed ? <TriangleAlert size={19} /> : verified ? <ShieldCheck size={19} /> : <LoaderCircle size={19} className={styles.spinner} />}
                  <span role="status">{statusText}</span>
                </div>
              </div>
              <div className={styles['status-track']} data-complete={verified} aria-hidden="true">
                <span />
              </div>
              {failed ? (
                <div className={styles['failure-detail']}>
                  <p role="alert">{error || '暂时无法连接，请稍后重试。'}</p>
                  <button type="button" onClick={onDismiss} autoFocus>
                    <ArrowLeft size={16} />
                    返回登录
                  </button>
                </div>
              ) : (
                <div className={styles['connection-note']}>
                  {verified ? <Check size={14} /> : <span className={styles['signal-dot']} />}
                  <span>{verified ? 'ACCESS GRANTED' : 'VERIFYING IDENTITY'}</span>
                </div>
              )}
            </div>
          </div>

          <footer className={styles['terminal-footer']}>
            <div className={styles['station-info']}>
              <span>接驳点</span>
              <strong>{location}</strong>
            </div>
            <ol className={styles['connection-steps']} aria-label="连接状态">
              <li data-active={!verified && !failed}>01 / LINK</li>
              <li data-active={!verified && !failed}>02 / AUTH</li>
              <li data-active={verified}>03 / ACCESS</li>
            </ol>
            <span className={styles['footer-brand']}>YOROROICE ARK <span className={styles['square-mark']} /></span>
          </footer>
        </div>
        <div className={styles.shutter} aria-hidden="true" />
      </section>
    </Portal>
  );
}
