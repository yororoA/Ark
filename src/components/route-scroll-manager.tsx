'use client'

import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import { hasPendingListReturn, prepareListReturn } from '@/components/blog/list-navigation'

export default function RouteScrollManager() {
  const pathname = usePathname()

  useLayoutEffect(() => {
    // Browser back (including a phone's edge gesture) must restore the same
    // filtered list position as the visible return link.
    const restoreList = () => prepareListReturn(`${location.pathname}${location.search}`)
    window.addEventListener('popstate', restoreList)
    return () => window.removeEventListener('popstate', restoreList)
  }, [])

  useLayoutEffect(() => {
    const previousRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'
    const currentPath = `${pathname}${location.search}`
    const preserveListPosition = hasPendingListReturn(currentPath)
    const frame = requestAnimationFrame(() => {
      const hash = location.hash.slice(1)
      let targetId = hash
      try { targetId = decodeURIComponent(hash) } catch { /* Keep malformed historical anchors unchanged. */ }
      const target = targetId ? document.getElementById(targetId) : null
      if (target) target.scrollIntoView()
      else if (!preserveListPosition) window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    })
    return () => {
      cancelAnimationFrame(frame)
      history.scrollRestoration = previousRestoration
    }
  }, [pathname])

  return null
}
