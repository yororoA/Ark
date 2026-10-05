'use client'

import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import { hasPendingListReturn } from '@/components/blog/list-navigation'

export default function RouteScrollManager() {
  const pathname = usePathname()

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
