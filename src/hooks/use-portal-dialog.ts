'use client'

import { useEffect, useRef, useState } from 'react'
import { observeVisualViewport } from '@/lib/visual-viewport'

// Login panels share a portal. Keep touch scrolling and keyboard focus inside
// the active panel, including when a nested confirmation temporarily replaces it.
export function usePortalDialog(close?: () => void, active = true) {
  const [dialog, setDialog] = useState<HTMLDivElement | null>(null)
  const closeRef = useRef(close)
  useEffect(() => { closeRef.current = close }, [close])
  useEffect(() => {
    if (!dialog) return
    const opener = document.activeElement
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    }
  }, [dialog])
  useEffect(() => {
    const overlay = dialog?.parentElement
    if (!overlay || !active) return
    return observeVisualViewport(overlay, 'dialog')
  }, [dialog, active])
  useEffect(() => {
    if (!dialog || !active) return
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.focus({ preventScroll: true })
    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !dialog.contains(event.target as Node)) return
      if (event.key === 'Escape' && closeRef.current) {
        event.preventDefault()
        closeRef.current()
      }
      if (event.key !== 'Tab') return
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')]
        .filter(element => element.getClientRects().length && !element.closest('[inert]'))
      const first = controls[0]
      const last = controls.at(-1)
      if (!first) { event.preventDefault(); dialog.focus(); return }
      const atStart = document.activeElement === first || document.activeElement === dialog
      const atEnd = document.activeElement === last || document.activeElement === dialog
      if (event.shiftKey && atStart) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && atEnd) { event.preventDefault(); first.focus() }
    }
    dialog.addEventListener('keydown', keyboard)
    return () => {
      dialog.removeEventListener('keydown', keyboard)
      document.body.style.overflow = overflow
    }
  }, [dialog, active])
  return setDialog
}
