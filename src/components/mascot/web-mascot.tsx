'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { PawPrint, X } from 'lucide-react'
import styles from './web-mascot.module.scss'

const STORAGE_KEY = 'ark.mascot:v1'
const PREFERENCE_EVENT = 'ark:mascot-preference'
const MOBILE_QUERY = '(max-width: 767px), (pointer: coarse)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const MASCOT_PACKS = ['Neuron', 'Eviling'] as const

type MascotStatus = 'idle' | 'ready' | 'error'

function connection() {
  return (navigator as Navigator & {
    connection?: EventTarget & { saveData?: boolean; effectiveType?: string }
  }).connection
}

function readPreference(): boolean | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'on') return true
    if (value === 'off') return false
  } catch {
    // The default remains available when storage is blocked.
  }
  return null
}

function savePreference(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  } catch {
    // Keep the selection for this page session.
  }
  window.dispatchEvent(new Event(PREFERENCE_EVENT))
}

function readEnabled() {
  const preference = readPreference()
  if (preference !== null) return preference
  const network = connection()
  if (network?.saveData || /^(slow-)?2g$/.test(network?.effectiveType || '')) return false
  return !matchMedia(MOBILE_QUERY).matches && !matchMedia(REDUCED_MOTION_QUERY).matches
}

function subscribe(listener: () => void) {
  const mobile = matchMedia(MOBILE_QUERY)
  const reducedMotion = matchMedia(REDUCED_MOTION_QUERY)
  const network = connection()
  const storage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener()
  }
  mobile.addEventListener('change', listener)
  reducedMotion.addEventListener('change', listener)
  network?.addEventListener('change', listener)
  window.addEventListener('storage', storage)
  window.addEventListener(PREFERENCE_EVENT, listener)
  return () => {
    mobile.removeEventListener('change', listener)
    reducedMotion.removeEventListener('change', listener)
    network?.removeEventListener('change', listener)
    window.removeEventListener('storage', storage)
    window.removeEventListener(PREFERENCE_EVENT, listener)
  }
}

export default function WebMascot() {
  const pathname = usePathname()
  const hostRef = useRef<HTMLDivElement>(null)
  const manualStart = useRef(false)
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => false)
  const [status, setStatus] = useState<MascotStatus>('idle')
  const isLogin = pathname === '/login' || pathname.startsWith('/login/')
  const shouldRun = enabled && !isLogin

  useEffect(() => {
    if (!shouldRun) return

    const host = hostRef.current
    if (!host) return
    let active = true
    let idle = 0
    let timer = 0
    let destroy: (() => void) | undefined

    const start = async () => {
      if (!active) return
      try {
        const { configure, createMascot } = await import('web-mascot')
        if (!active) return
        configure({
          assets: '/mascot_pack',
          animationConfigUrl: '/mascot_pack/animation.config.json',
        })
        const results = await Promise.allSettled(
          MASCOT_PACKS.map(pack => createMascot({ container: host, pack })),
        )
        const mascots = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
        const failed = results.find(result => result.status === 'rejected')
        if (!active) {
          mascots.forEach(mascot => mascot.destroy())
          return
        }
        if (failed) {
          mascots.forEach(mascot => mascot.destroy())
          throw failed.reason
        }
        destroy = () => mascots.forEach(mascot => mascot.destroy())
        Array.from(host.children).forEach(child => child.setAttribute('data-ark-mascot', ''))
        setStatus('ready')
      } catch {
        if (active) setStatus('error')
      }
    }
    // The engine preloads every sprite in both packs. Let the page's fonts,
    // images and scripts finish before starting this optional download.
    const schedule = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idle = window.requestIdleCallback(start, { timeout: 2000 })
      } else {
        timer = window.setTimeout(start, 0)
      }
    }
    if (manualStart.current) void start()
    else if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })

    return () => {
      active = false
      window.removeEventListener('load', schedule)
      if (idle) window.cancelIdleCallback(idle)
      window.clearTimeout(timer)
      destroy?.()
      host.replaceChildren()
    }
  }, [shouldRun])

  if (isLogin) return null

  const label = enabled
    ? '隐藏桌宠 / Hide mascot'
    : '显示桌宠 / Show mascot'

  const toggle = () => {
    const nextEnabled = !enabled
    manualStart.current = nextEnabled
    setStatus('idle')
    savePreference(nextEnabled)
  }

  return <>
    {enabled ? <div ref={hostRef} className={styles['mascot-host']} aria-hidden="true" /> : null}
    <button
      type="button"
      className={styles['mascot-toggle']}
      data-active={enabled ? '' : undefined}
      data-status={enabled ? status : 'idle'}
      aria-label={label}
      aria-pressed={enabled}
      title={label}
      onClick={toggle}
    >
      {enabled ? <X size={19} strokeWidth={1.7} /> : <PawPrint size={19} strokeWidth={1.7} />}
    </button>
  </>
}
