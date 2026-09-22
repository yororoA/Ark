'use client'

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, TriangleAlert } from 'lucide-react';
import Portal from '@/components/Portal';
import { CONNECTION_TIMING as TIMING } from './connectionTimeline';
import styles from './connectionSequence.module.scss';
import Loading from '@/components/arks/loading';

const ConnectionNetwork = dynamic(() => import('./connectionNetwork'), { ssr: false });
const DECODE_LINES = [
  'RTQ17 / AKRHO4',
  'XBNEQ / TYRMNLS',
  'B7A01 / VN5KQ2',
  'CNX47 / AU0HZD',
  'QPR8S / NX0041',
  'BINES NETWORK',
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
// Fixed cells stay in place; an S-curve controls their reveal cadence.
const easeInOut = (progress: number) =>
  progress * progress * (3 - 2 * progress);
const createRailCells = (count: number, start: number, end: number) =>
  Array.from({ length: count }, (_, index) => {
    const progress = count === 1 ? 1 : index / (count - 1);
    return Math.round(TIMING.boot * (
      start + (end - start) * easeInOut(progress)
    ));
  });
const LEFT_RAIL_CELLS = createRailCells(36, .45, .665);
const RIGHT_RAIL_CELLS = createRailCells(18, .69, .975);
const REFERENCE_VIEWPORT = { width: 960, height: 540 } as const;
const MAX_SEQUENCE_SCALE = 1.75;
const timelineStyle = {
  '--boot-duration': `${TIMING.boot}ms`,
  '--terminal-duration': `${TIMING.terminal}ms`,
  '--identity-duration': `${TIMING.identity}ms`,
  '--sync-duration': `${TIMING.sync}ms`,
  '--exit-duration': `${TIMING.exit}ms`,
  '--sequence-scale': 1,
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

function BootPlane({
  projection = false,
  defocused = false,
}: {
  projection?: boolean;
  defocused?: boolean;
}) {
  const className = defocused
    ? styles['boot-defocus-plane']
    : projection
      ? `${styles['boot-plane']} ${styles['boot-projection']}`
      : styles['boot-plane'];

  return (
    <div className={className} aria-hidden="true">
      <div className={styles['signal-rail']}>
        {/* Previous split rails:
        <span className={styles['rail-left']} />
        <span className={styles['rail-right']} /> */}
        <span className={styles['rail-line']} />
        <span className={styles['rail-ticks']}>
          {LEFT_RAIL_CELLS.map((delay, index) => (
            <i
              key={index}
              style={{ '--cell-delay': `${delay}ms` } as CSSProperties}
            />
          ))}
        </span>
        <span className={styles['rail-stripes']} />
        <span className={styles['rail-upper-nodes']}>
          {RIGHT_RAIL_CELLS.map((delay, index) => (
            <i
              key={index}
              style={{ '--cell-delay': `${delay}ms` } as CSSProperties}
            />
          ))}
        </span>
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
          {'YOROROICE'.split('').map((letter, index) => (
            <span key={index} style={{ '--matrix-index': index } as CSSProperties}>{letter}</span>
          ))}
        </div>
        {/* The previous overlay mask was replaced by a transparent gap in the rail itself. */}
      </div>
      <div className={styles['frame-haze']} />
      <div className={styles['outer-frame']} />
      <div className={styles['boot-plaque']}>
        <span className={styles['plaque-base-edges']}>
          {Array.from({ length: 4 }, (_, index) => <i key={index} />)}
        </span>
        <span className={styles['plaque-rim']} />
        <span className={styles['plaque-crossline']} />
        <strong>BINES</strong>
        <small>YOROROICE ARK</small>
      </div>
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
  const [stage, setStage] = useState<'boot' | 'terminal' | 'sync' | 'exit'>('boot');
  const [introComplete, setIntroComplete] = useState(false);
  const [networkReady, setNetworkReady] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const handleNetworkReady = useCallback(() => setNetworkReady(true), []);
  const updateNetworkProgress = useCallback((value: number) => {
    const progress = progressRef.current;
    if (!progress) return;
    progress.style.setProperty('--network-progress', `${value / 2}%`);
    progress.dataset.progress = `${value}`;
    progress.querySelectorAll('i').forEach(label => {
      label.textContent = `${value}%`;
    });
  }, []);

  useLayoutEffect(() => {
    const updateSequenceScale = () => {
      const viewportScale = Math.min(
        window.innerWidth / REFERENCE_VIEWPORT.width,
        window.innerHeight / REFERENCE_VIEWPORT.height,
      );
      const scale = Math.min(MAX_SEQUENCE_SCALE, Math.max(1, viewportScale));
      dialogRef.current?.style.setProperty('--sequence-scale', scale.toFixed(3));
    };

    updateSequenceScale();
    window.addEventListener('resize', updateSequenceScale);
    return () => window.removeEventListener('resize', updateSequenceScale);
  }, []);

  useEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
    // Fetch the small 3D chunk during the opening, before the network stage.
    void import('./connectionNetwork');
  }, []);

  useEffect(() => {
    const terminal = window.setTimeout(() => setStage('terminal'), TIMING.boot);
    const ready = window.setTimeout(() => setIntroComplete(true), TIMING.boot + TIMING.terminal);
    return () => {
      window.clearTimeout(terminal);
      window.clearTimeout(ready);
    };
  }, []);

  useEffect(() => {
    if (!introComplete || status !== 'success') return;
    const sync = window.setTimeout(() => {
      updateNetworkProgress(0);
      setStage('sync');
    }, TIMING.identity);
    return () => window.clearTimeout(sync);
  }, [introComplete, status, updateNetworkProgress]);

  useEffect(() => {
    if (stage !== 'sync') return;

    let progress = 0;
    let frame = 0;
    let renderedProgress = 0;
    const startedAt = performance.now();
    let nextStepAt = startedAt + 100;
    const advanceProgress = (now: number) => {
      while (now >= nextStepAt && progress < 100) {
        progress = Math.min(100, progress + 12 + Math.floor(Math.random() * 9));
        nextStepAt += 100;
      }
      if (now - startedAt >= 600) progress = 100;
      if (progress !== renderedProgress) {
        updateNetworkProgress(progress);
        renderedProgress = progress;
      }
      frame = requestAnimationFrame(advanceProgress);
    };

    updateNetworkProgress(0);
    frame = requestAnimationFrame(advanceProgress);
    const exit = window.setTimeout(() => {
      progress = 100;
      updateNetworkProgress(100);
      setStage('exit');
    }, TIMING.sync);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(exit);
    };
  }, [stage, updateNetworkProgress]);

  useEffect(() => {
    if (stage !== 'exit') return;
    const complete = window.setTimeout(onComplete, TIMING.exit);
    return () => window.clearTimeout(complete);
  }, [stage, onComplete]);

  // #region debug-point A,B,C,D:network-motion-sampling
  useEffect(() => {
    if (stage !== 'sync' && stage !== 'exit') return;
    const network = dialogRef.current?.querySelector<HTMLElement>(
      `.${styles['network-stage']}`,
    );
    const shade = dialogRef.current?.querySelector<HTMLElement>(
      `.${styles['exit-shade']}`,
    );
    if (!network || !shade) return;

    const startedAt = performance.now();
    const samples: Array<{
      elapsed: number;
      scale: number;
      opacity: number;
      shadeOpacity: number;
    }> = [];
    let frame = 0;
    let previousFrame = startedAt;
    let nextSampleAt = 0;
    let maxFrameGap = 0;
    let slowFrames = 0;

    const sample = (now: number) => {
      const elapsed = now - startedAt;
      const frameGap = now - previousFrame;
      previousFrame = now;
      maxFrameGap = Math.max(maxFrameGap, frameGap);
      if (frameGap > 25) slowFrames += 1;

      if (elapsed >= nextSampleAt) {
        const networkStyle = getComputedStyle(network);
        const matrix = new DOMMatrixReadOnly(networkStyle.transform);
        samples.push({
          elapsed: Math.round(elapsed),
          scale: Number(Math.hypot(matrix.a, matrix.b).toFixed(4)),
          opacity: Number(networkStyle.opacity),
          shadeOpacity: Number(getComputedStyle(shade).opacity),
        });
        nextSampleAt += 50;
      }

      if (elapsed < 650) {
        frame = requestAnimationFrame(sample);
        return;
      }

      void fetch('http://127.0.0.1:7777/event', {
        method: 'POST',
        keepalive: true,
        body: JSON.stringify({
          sessionId: 'network-motion-smoothness',
          runId: 'post-fix',
          hypothesisId: 'A,B,C,D',
          location: `connectionSequence.tsx:${stage}-motion`,
          msg: `[DEBUG] ${stage} motion sampled`,
          data: { maxFrameGap, slowFrames, samples },
          ts: Date.now(),
        }),
      }).catch(() => {});
    };

    frame = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(frame);
  }, [stage]);
  // #endregion

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
            <BootPlane projection />
            <div className={styles['boot-defocus-layer']}>
              <BootPlane defocused />
            </div>
            <div className={styles['boot-primary-layer']}>
              <BootPlane />
            </div>
          </div>
        </div>

        <div className={styles['terminal-stage']} aria-hidden={phase === 'boot' || networkVisible}>
          <div className={styles['corner-seed']} aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => <span key={index} />)}
          </div>
          <div className={styles['terminal-motion']}>
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
                <span className={styles['terminal-code']} aria-hidden="true">BX-01 / SECURE CHANNEL</span>
              </div>
            </div>

            {verified && (
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
          </div>
          {failed && (
            <div className={styles['failure-detail']}>
              <TriangleAlert size={20} />
              <p role="alert">{error || '暂时无法连接，请稍后重试。'}</p>
              <button type="button" onClick={onDismiss} autoFocus><ArrowLeft size={16} />返回登录</button>
            </div>
          )}
          <footer className={styles['terminal-footer']}>BINES NETWORK <span /></footer>
          {phase === 'success' && <Loading type="animation" text="正在建立神经连接" />}
        </div>

        {verified && (
          <div className={styles['network-stage']} aria-hidden={!networkVisible}>
            <ConnectionNetwork onReady={handleNetworkReady} />
            {networkReady && <>
              <div className={styles['station-plate']}>
                <span>接驳点</span>
                <strong>{location}</strong>
                <div><sup>#</sup>0</div>
              </div>
              <div
                ref={progressRef}
                className={styles['network-link']}
                data-testid="connection-progress"
                data-progress="0"
                aria-hidden="true"
              >
                <span><i>0%</i></span>
                <span><i>0%</i></span>
              </div>
              <p>正在尝试与 BINES Network 进行认知同步</p>
            </>}
          </div>
        )}
        <div className={styles['exit-shade']} aria-hidden="true" />
        <div className={styles['exit-handoff']} aria-hidden="true">
          <span className={styles['handoff-line']} />
          <div className={styles['handoff-emblem']}>
            <span className={styles['handoff-tower']}><i /><i /></span>
            <strong>BINES</strong>
          </div>
          <span className={styles['handoff-dots']}>
            {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
          </span>
          <p>BINES NEURAL INTERFACE</p>
        </div>
      </section>
    </Portal>
  );
}
