'use client'

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import Portal from '@/components/Portal';
import { CONNECTION_TIMING as TIMING } from './connectionTimeline';
import styles from './connectionSequence.module.scss';
import Loading from '@/components/arks/loading';

const ConnectionNetwork = dynamic(() => import('./connectionNetwork'), { ssr: false });
const MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DECODE_LINES = [
  'RTQ17 / AKRHO4',
  'XBNEQ / TYRMNLS',
  'B7A01 / VN5KQ2',
  'CNX47 / AU0HZD',
  'QPR8S / NX0041',
  'BINES / NETWORK',
];
const BRAND_FRAGMENTS = [
  { x: -176, y: 18, delay: 0 },
  { x: 124, y: -10, delay: 26 },
  { x: -88, y: 9, delay: 44 },
  { x: 158, y: -17, delay: 62 },
  { x: -132, y: 13, delay: 78 },
  { x: 94, y: -7, delay: 94 },
  { x: -48, y: 4, delay: 108 },
];
const timelineStyle = {
  '--boot-duration': `${TIMING.boot}ms`,
  '--terminal-duration': `${TIMING.terminal}ms`,
  '--identity-duration': `${TIMING.identity}ms`,
  '--sync-duration': `${TIMING.sync}ms`,
  '--exit-duration': `${TIMING.exit}ms`,
} as CSSProperties;

export interface ConnectionState {
  status: 'pending' | 'success' | 'error';
  username: string;
  role?: 'ADMINISTRATOR' | 'USER' | 'GUEST';
  error?: string;
}

interface ConnectionSequenceProps extends ConnectionState {
  location: string;
  onComplete: () => void;
  onDismiss: () => void;
}

function subscribeToMotion(onChange: () => void) {
  const media = window.matchMedia(MOTION_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

function CornerMarks() {
  return <div className={styles['corner-marks']} aria-hidden="true">
    {Array.from({ length: 4 }, (_, index) => <span key={index} />)}
  </div>;
}

function CredentialScan({ username }: { username: string }) {
  return (
    <div className={styles['credential-scan']} aria-hidden="true">
      <div className={styles['scan-outline']} />
      <div className={styles['scan-symbols']}>
        {Array.from({ length: 9 }, (_, index) => <span key={index} style={{ '--index': index } as CSSProperties}>/</span>)}
      </div>
      <span className={styles['credential-monogram']}>{Array.from(username)[0]?.toUpperCase() || 'B'}</span>
      <span className={styles['credential-id']}>ID / 01</span>
      <span className={styles['credential-name']}>{username}</span>
      <span className={styles['credential-ticks']} />
    </div>
  );
}

export default function ConnectionSequence({
  status,
  username,
  role = 'USER',
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
  const [stage, setStage] = useState<'boot' | 'terminal' | 'sync' | 'exit'>('boot');
  const [introComplete, setIntroComplete] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
    // Fetch the small 3D chunk during the opening, before the network stage.
    void import('./connectionNetwork');
  }, []);

  useEffect(() => {
    const terminal = window.setTimeout(() => setStage('terminal'), reducedMotion ? 0 : TIMING.boot);
    const ready = window.setTimeout(() => setIntroComplete(true), reducedMotion ? 0 : TIMING.boot + TIMING.terminal);
    return () => {
      window.clearTimeout(terminal);
      window.clearTimeout(ready);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (!introComplete || status !== 'success') return;
    const identity = reducedMotion ? 100 : TIMING.identity;
    const syncDuration = reducedMotion ? 100 : TIMING.sync;
    const sync = window.setTimeout(() => setStage('sync'), identity);
    const exit = window.setTimeout(() => setStage('exit'), identity + syncDuration);
    const complete = window.setTimeout(onComplete, identity + syncDuration + (reducedMotion ? 100 : TIMING.exit));
    return () => {
      window.clearTimeout(sync);
      window.clearTimeout(exit);
      window.clearTimeout(complete);
    };
  }, [introComplete, status, reducedMotion, onComplete]);

  const phase = status === 'error' ? 'error'
    : stage === 'sync' || stage === 'exit' ? stage
      : introComplete && status === 'success' ? 'success' : stage;
  const verified = phase === 'success' || phase === 'sync' || phase === 'exit';
  const failed = phase === 'error';
  const networkVisible = phase === 'sync' || phase === 'exit';
  const usernameCharacters = Array.from(username).slice(0, 24);
  const usernameTruncated = usernameCharacters.length < Array.from(username).length;

  return (
    <Portal black={false}>
      <section
        ref={dialogRef}
        className={styles.sequence}
        style={timelineStyle}
        data-phase={phase}
        data-testid="connection-sequence"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-label="BINES 连接终端"
        aria-busy={status === 'pending'}
      >
        <span className={styles['screen-reader-status']} role="status">
          {failed ? '连接未完成' : verified ? '身份认证通过' : '正在进行身份认证'}
        </span>
        <div className={styles['boot-stage']} aria-hidden="true">
          <div className={styles['boot-backdrop']} />
          <div className={styles['boot-composition']}>
            <div className={styles['signal-rail']}>
              <span className={styles['rail-left']} />
              <span className={styles['rail-right']} />
              <span className={styles['rail-ticks']} />
              <span className={styles['rail-stripes']} />
              <span className={styles['rail-packets']} />
              <div className={styles['decode-copy']}>
                <div className={styles['decode-rows']}>
                  <div className={styles['decode-track']}>
                    {DECODE_LINES.map((line, index) => <span key={line} style={{ '--decode-index': index } as CSSProperties}>{line}</span>)}
                  </div>
                </div>
                <span>TERMINAL SERVICE</span>
                <i />
              </div>
              <div className={styles['letter-matrix']}>
                {'BINES'.split('').map((letter, index) => (
                  <span key={index} style={{ '--matrix-index': index } as CSSProperties}>{letter}</span>
                ))}
              </div>
            </div>
            <div className={styles['outer-frame']} />
            <div className={styles['echo-frame']} />
            <div className={styles['boot-plaque']}>
              <span className={styles['plaque-rim']} />
              <span className={styles['plaque-crossline']} />
              <strong>BINES</strong>
              <small>YOROROICE ARK</small>
            </div>
          </div>
        </div>

        <div className={styles['terminal-stage']} aria-hidden={phase === 'boot' || networkVisible}>
          <div className={styles['corner-seed']} aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => <span key={index} />)}
          </div>
          <div className={styles['terminal-content']}>
            <CornerMarks />
            <div className={styles['terminal-brand']}>
              <span className={styles['brand-rule']} />
              <h1 className={styles['brand-word']}>
                <span className={styles['brand-label']}>BINES</span>
                {BRAND_FRAGMENTS.map((fragment, slice) => (
                  <span
                    key={slice}
                    className={styles['brand-slice']}
                    data-slice={slice}
                    style={{
                      '--fragment-x': `${fragment.x}px`,
                      '--fragment-y': `${fragment.y}px`,
                      '--fragment-delay': `${fragment.delay}ms`,
                    } as CSSProperties}
                    aria-hidden="true"
                  >
                    BINES
                  </span>
                ))}
              </h1>
              <strong>YOROROICE ARK</strong>
              <span className={styles['brand-subtitle']}>TERMINAL SERVICE</span>
              <span className={styles['brand-rule']} />
            </div>
            <div className={styles.divider} aria-hidden="true"><span /><span /></div>
            <div className={styles['identity-panel']}>
              <div className={styles['identity-field']}>
                <span className={styles['field-label']}>USERNAME</span>
                <div className={styles['field-box']}>
                  <span className={styles['field-value']} title={username} aria-label={username}>
                    {usernameCharacters.map((character, index) => (
                      <span className={styles['typed-character']} style={{ '--character-delay': `${index * 52}ms` } as CSSProperties} key={`${character}-${index}`} aria-hidden="true">
                        {character === ' ' ? '\u00a0' : character}
                      </span>
                    ))}
                    {usernameTruncated && <span className={styles['typed-ellipsis']} aria-hidden="true">...</span>}
                  </span>
                </div>
              </div>
              <div className={styles['identity-field']}>
                <span className={styles['field-label']}>AUTHENTICATION</span>
                <div className={styles['field-box']}>
                  <span className={styles['auth-code']} aria-hidden="true">
                    {Array.from({ length: 10 }, (_, index) => (
                      <span className={styles['typed-character']} style={{ '--character-delay': `${index * 82}ms` } as CSSProperties} key={index}>*</span>
                    ))}
                  </span>
                </div>
              </div>
              <span className={styles['connection-note']} aria-hidden="true">{failed ? 'CONNECTION FAILED' : 'VERIFYING IDENTITY'}</span>
            </div>
          </div>

          {verified && !networkVisible && (
            <div className={styles['identity-confirmation']}>
              <CornerMarks />
              <div className={styles['welcome-copy']}>
                <span className={styles['welcome-role']}>{role}</span>
                <span className={styles['welcome-identified']}>IDENTIFIED</span>
                <strong>WELCOME</strong>
              </div>
              <CredentialScan username={username} />
            </div>
          )}
          {failed && (
            <div className={styles['failure-detail']}>
              <TriangleAlert size={20} />
              <p role="alert">{error || '暂时无法连接，请稍后重试。'}</p>
              <button type="button" onClick={onDismiss} autoFocus><ArrowLeft size={16} />返回登录</button>
            </div>
          )}
          <footer className={styles['terminal-footer']}>BINES NETWORK <span /></footer>
          {phase === 'success' && !reducedMotion && <Loading type="animation" text="正在建立神经连接" />}
        </div>

        {networkVisible && (
          <div className={styles['network-stage']}>
            <ConnectionNetwork reducedMotion={reducedMotion} />
            <div className={styles['station-plate']}>
              <span>接驳点</span>
              <strong>{location}</strong>
              <div><sup>#</sup>0</div>
            </div>
            <div className={styles['network-link']} aria-hidden="true"><span /><span /></div>
            <p>正在尝试与 BINES Network 进行认知同步</p>
          </div>
        )}
        <div className={styles['exit-shade']} aria-hidden="true" />
      </section>
    </Portal>
  );
}
