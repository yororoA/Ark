'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, type ComponentProps } from 'react'
import { requestP3RWipe } from './p3r-transition'

export default function P3RLink({ onClick, onNavigate, replace, scroll, transitionTypes, ...props }: ComponentProps<typeof Link>) {
  const router = useRouter()
  const origin = useRef({ x: 0, y: 0, href: '' })

  return <Link {...props} replace={replace} scroll={scroll} transitionTypes={transitionTypes} data-p3r-link
    onClick={event => {
      const anchor = event.currentTarget
      const rect = anchor.getBoundingClientRect()
      origin.current = {
        x: event.detail ? event.clientX : rect.left + rect.width / 2,
        y: event.detail ? event.clientY : rect.top + rect.height / 2,
        href: anchor.href,
      }
      onClick?.(event)
    }}
    onNavigate={event => {
      const { x, y, href } = origin.current
      if (!href) { onNavigate?.(event); return }
      const url = new URL(href, location.href)
      const changesPage = url.origin === location.origin && url.pathname !== location.pathname
      // Hashes, same-page filters, modified clicks, downloads and external
      // links keep Next/browser semantics. onNavigate excludes the latter three.
      if (!changesPage) {
        onNavigate?.(event)
        requestP3RWipe({ x, y })
        return
      }
      const accepted = requestP3RWipe({ x, y, navigate: () => {
        let cancelled = false
        onNavigate?.({ preventDefault: () => { cancelled = true } })
        if (cancelled) return false
        const destination = `${url.pathname}${url.search}${url.hash}`
        router[replace ? 'replace' : 'push'](destination, { scroll, transitionTypes })
        return true
      } })
      if (accepted) event.preventDefault()
      else onNavigate?.(event)
    }}
  />
}
