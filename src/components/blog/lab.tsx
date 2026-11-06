'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import { useAppearance } from '@/components/appearance/appearance-store'
import { useBlog } from './blog-provider'
import { PageHeading, styles } from './shared'
import { LAB_WORKSPACE_COPY } from './lab-workspace-copy'
import workspace from './lab-workspace.module.scss'

const TOOL_URL = '/lab/function-speed-player.html'
type ToolStatus = 'loading' | 'ready' | 'slow' | 'failed'

export default function Lab() {
  const { t, locale } = useBlog()
  const { design, colorMode } = useAppearance()
  const voyage = design === 'voyage'
  const copy = LAB_WORKSPACE_COPY[locale]
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<ToolStatus>('loading')
  const frame = useRef<HTMLIFrameElement>(null)
  const panel = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const returnPosition = useRef<number | null>(null)
  const appearance = useRef({ design: voyage ? 'voyage' : 'default', mode: colorMode })

  useLayoutEffect(() => {
    appearance.current = { design: voyage ? 'voyage' : 'default', mode: colorMode }
  }, [voyage, colorMode])

  function configure() {
    frame.current?.contentWindow?.postMessage({ type: 'ark:lab:configure', ...appearance.current }, '*')
  }
  function toggle() {
    if (!open) { returnPosition.current = voyage ? window.scrollY : null; setStatus('loading') }
    setOpen(value => !value)
  }
  useLayoutEffect(() => {
    if (open && voyage && panel.current) {
      const header = document.querySelector('[data-blog-root] > header')?.getBoundingClientRect().height || 0
      window.scrollTo({ top: window.scrollY + panel.current.getBoundingClientRect().top - header - 12, behavior: 'instant' })
      heading.current?.focus({ preventScroll: true })
    } else if (!open && returnPosition.current !== null) {
      window.scrollTo({ top: returnPosition.current, behavior: 'instant' })
      opener.current?.focus({ preventScroll: true })
      returnPosition.current = null
    }
  }, [open, voyage])
  useEffect(() => {
    if (!open || !voyage) return
    const timer = window.setTimeout(() => setStatus(current => current === 'loading' ? 'slow' : current), 6000)
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return
      // The bridge requests appearance before the engine finishes loading, so
      // a slow script never leaves the original dark console inside light mode.
      if (event.data?.type === 'ark:lab:configure-request') {
        frame.current?.contentWindow?.postMessage({ type: 'ark:lab:configure', ...appearance.current }, '*')
        return
      }
      if (event.data?.type !== 'ark:lab:status') return
      if (event.data.status !== 'ready' && event.data.status !== 'error') return
      window.clearTimeout(timer)
      setStatus(event.data.status === 'ready' ? 'ready' : 'failed')
    }
    window.addEventListener('message', receive)
    return () => { window.clearTimeout(timer); window.removeEventListener('message', receive) }
  }, [open, voyage, attempt])
  useEffect(() => {
    if (!open || !voyage) return
    frame.current?.contentWindow?.postMessage({ type: 'ark:lab:configure', design: 'voyage', mode: colorMode }, '*')
  }, [colorMode, open, voyage])

  return <div className={styles['page']}><PageHeading title="lab" english="Small experiments" number="06" />
    <section className={styles['lab-poster']}><div><div className={styles['eyebrow']}>EXPERIMENT 001 / f(t)</div><h2>{t('labTitle')}</h2><p>{t('labBody')}</p><button ref={opener} className={styles['primary-button']} onClick={toggle} aria-expanded={open} aria-controls="lab-workspace">{t(open ? 'close' : 'openTool')}{open ? <X size={16} /> : <ArrowUpRight size={16} />}</button></div>
      <svg viewBox="0 0 500 300" fill="none" aria-hidden="true"><path d="M0 150H500M250 0V300" stroke="currentColor" opacity=".2" /><circle cx="250" cy="150" r="120" stroke="currentColor" opacity=".3" /><path d="M0 150C60 -35 100 -35 160 150S260 335 320 150 420 -35 500 150" stroke="currentColor" strokeWidth="2" /><path d="M20 150C70 90 110 90 160 150S270 210 320 150 430 90 480 150" stroke="currentColor" strokeWidth=".5" /><text x="365" y="268" fill="currentColor" fontSize="28" fontFamily="Georgia" fontStyle="italic">f(t) = memory</text></svg>
    </section>
    {open && (voyage ? <section ref={panel} id="lab-workspace" className={workspace.workspace} data-testid="voyage-lab-workspace" data-status={status} aria-labelledby="lab-workspace-title">
      <header className={workspace.header}>
        <div className={workspace.identity}><span className={workspace.index}>{copy.experiment} / f(t)</span><h2 ref={heading} tabIndex={-1} id="lab-workspace-title" className={workspace.title}>{copy.workspace}</h2></div>
        <p className={workspace.status} role="status" aria-label={copy.status}>{status === 'ready' ? copy.ready : status === 'loading' ? copy.loading : status === 'slow' ? copy.loading : copy.failed}</p>
        <button type="button" className={workspace.close} onClick={toggle} aria-label={copy.close}><X size={18} aria-hidden="true" /></button>
      </header>
      {(status === 'slow' || status === 'failed') && <div className={workspace.notice}>
        <p>{copy[status]}</p><div className={workspace.links}><button type="button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1) }}>{copy.retry}</button><a href={TOOL_URL} target="_blank" rel="noopener noreferrer">{copy.external}<ArrowUpRight size={14} aria-hidden="true" /></a></div>
      </div>}
      <iframe key={attempt} ref={frame} className={workspace.frame} src={TOOL_URL} title={copy.workspace} sandbox="allow-scripts" allow="autoplay" onLoad={configure} onError={() => setStatus('failed')} aria-busy={status === 'loading'} />
    </section> : <iframe id="lab-workspace" className={styles['tool-frame']} src={TOOL_URL} title={t('openTool')} sandbox="allow-scripts" allow="autoplay" />)}
  </div>
}
