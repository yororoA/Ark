'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { COLOR_MODE_KEY, DESIGN_KEY, parseColorMode, parseDesign, type ColorMode, type Design } from '@/lib/appearance'

const listeners = new Set<() => void>()
const readDesign = () => parseDesign(document.documentElement.dataset.design)
const readColorMode = () => parseColorMode(document.documentElement.dataset.theme)
const serverDesign = (): Design => 'archive'
const serverColorMode = (): ColorMode => 'system'

function emit() {
  listeners.forEach(listener => listener())
}

function onStorage(event: StorageEvent) {
  try {
    if (event.storageArea !== localStorage) return
    const root = document.documentElement
    if (event.key === DESIGN_KEY || event.key === null) root.dataset.design = parseDesign(localStorage.getItem(DESIGN_KEY))
    if (event.key === COLOR_MODE_KEY || event.key === null) root.dataset.theme = parseColorMode(localStorage.getItem(COLOR_MODE_KEY))
    emit()
  } catch { /* The current tab remains usable if storage is unavailable. */ }
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener('storage', onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

function save(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* Keep the selection for this page session. */ }
}

export function setDesign(value: Design) {
  const design = parseDesign(value)
  document.documentElement.dataset.design = design
  save(DESIGN_KEY, design)
  emit()
}

export function setColorMode(value: ColorMode) {
  const mode = parseColorMode(value)
  document.documentElement.dataset.theme = mode
  save(COLOR_MODE_KEY, mode)
  emit()
}

export function useAppearance() {
  const design = useSyncExternalStore(subscribe, readDesign, serverDesign)
  const colorMode = useSyncExternalStore(subscribe, readColorMode, serverColorMode)
  return { design, colorMode, setDesign, setColorMode }
}

// Keep cross-tab synchronization alive through every route, without an effect
// that overwrites the pre-paint bootstrap with React's SSR defaults.
export function AppearanceObserver() {
  useEffect(() => subscribe(() => {}), [])
  return null
}
