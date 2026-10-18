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
const MIN_PAGE_SCALE = .5
const MAX_PAGE_SCALE = 2
let baselinePixelRatio: number | undefined

type MascotStatus = 'idle' | 'ready' | 'error'

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
  return !matchMedia(MOBILE_QUERY).matches && !matchMedia(REDUCED_MOTION_QUERY).matches
}

function subscribe(listener: () => void) {
  const mobile = matchMedia(MOBILE_QUERY)
  const reducedMotion = matchMedia(REDUCED_MOTION_QUERY)
  const storage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener()
  }
  mobile.addEventListener('change', listener)
  reducedMotion.addEventListener('change', listener)
  window.addEventListener('storage', storage)
  window.addEventListener(PREFERENCE_EVENT, listener)
  return () => {
    mobile.removeEventListener('change', listener)
    reducedMotion.removeEventListener('change', listener)
    window.removeEventListener('storage', storage)
    window.removeEventListener(PREFERENCE_EVENT, listener)
  }
}

function pageScale(baselinePixelRatio: number) {
  const pixelRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : baselinePixelRatio
  const viewportScale = window.visualViewport?.scale ?? 1
  const scale = pixelRatio / baselinePixelRatio * viewportScale
  return Math.min(MAX_PAGE_SCALE, Math.max(MIN_PAGE_SCALE, scale))
}

function readBaselinePixelRatio() {
  if (baselinePixelRatio !== undefined) return baselinePixelRatio
  baselinePixelRatio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1
  return baselinePixelRatio
}

export default function WebMascot() {
  const pathname = usePathname()
  const hostRef = useRef<HTMLDivElement>(null)
  const enabled = useSyncExternalStore(subscribe, readEnabled, () => false)
  const [status, setStatus] = useState<MascotStatus>('idle')
  const isLogin = pathname === '/login' || pathname.startsWith('/login/')
  const shouldRun = enabled && !isLogin

  useEffect(() => {
    if (!shouldRun) return

    const host = hostRef.current
    if (!host) return
    let active = true
    let destroy: (() => void) | undefined
    let removeScaleListeners: (() => void) | undefined

    void import('web-mascot')
      .then(async ({ configure, createMascot, MascotEngine }) => {
        if (!active) return
        configure({
          assets: '/mascot_pack',
          animationConfigUrl: '/mascot_pack/animation.config.json',
        })
        await MascotEngine.reloadAnimationConfig('/mascot_pack/animation.config.json')
        if (!active) return
        const initialPixelRatio = readBaselinePixelRatio()
        const baseConfig = MascotEngine.getAnimationConfig().toJSON()
        const baseScales = Object.fromEntries(
          MASCOT_PACKS.map(pack => [pack, MascotEngine.getAnimationConfig().mascotScale(pack)]),
        ) as Record<(typeof MASCOT_PACKS)[number], number>
        const baseMascots = baseConfig.mascots ?? {}
        let appliedScale = 0
        let scaleFrame = 0
        const applyPageScale = () => {
          const nextScale = pageScale(initialPixelRatio)
          if (Math.abs(nextScale - appliedScale) < .001) return
          appliedScale = nextScale
          const mascots = { ...baseMascots }
          for (const pack of MASCOT_PACKS) {
            mascots[pack] = {
              ...baseMascots[pack],
              scale: baseScales[pack] * nextScale,
            }
          }
          MascotEngine.setAnimationConfig({ ...baseConfig, mascots }, 'Ark page scale')
          host.dataset.pageScale = nextScale.toFixed(3)
        }
        const schedulePageScale = () => {
          cancelAnimationFrame(scaleFrame)
          scaleFrame = requestAnimationFrame(applyPageScale)
        }
        applyPageScale()
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
        window.addEventListener('resize', schedulePageScale)
        window.visualViewport?.addEventListener('resize', schedulePageScale)
        removeScaleListeners = () => {
          cancelAnimationFrame(scaleFrame)
          window.removeEventListener('resize', schedulePageScale)
          window.visualViewport?.removeEventListener('resize', schedulePageScale)
        }
        setStatus('ready')
      })
      .catch(() => {
        if (active) setStatus('error')
      })

    return () => {
      active = false
      removeScaleListeners?.()
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
