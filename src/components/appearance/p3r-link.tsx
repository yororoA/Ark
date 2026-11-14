'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type ComponentProps } from 'react'
import { requestP3RWipe } from './p3r-transition'
import { requestFoldTransition } from './fold-transition'

type P3RLinkProps = ComponentProps<typeof Link> & { voyagePassage?: boolean }

export default function P3RLink({ onClick, onFocus, onMouseEnter, onNavigate, prefetch, replace, scroll, transitionTypes, voyagePassage = false, ...props }: P3RLinkProps) {
  const router = useRouter()
  const origin = useRef({ x: 0, y: 0, href: '' })
  const [prefetchOnIntent, setPrefetchOnIntent] = useState(false)
  const linkPrefetch = prefetch === undefined ? (prefetchOnIntent ? null : false) : prefetch

  return <Link {...props} prefetch={linkPrefetch} replace={replace} scroll={scroll} transitionTypes={transitionTypes} data-p3r-link
    onMouseEnter={event => {
      if (prefetch === undefined) setPrefetchOnIntent(true)
      onMouseEnter?.(event)
    }}
    onFocus={event => {
      if (prefetch === undefined) setPrefetchOnIntent(true)
      onFocus?.(event)
    }}
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
      // Only a new pathname can get the full-page wipe. Hashes and same-page
      // filters keep their immediate behavior; modified clicks, downloads and
      // external links do not reach onNavigate.
      if (!changesPage) { onNavigate?.(event); return }
      // Night Voyage reserves the complete passage for its spatial menu.
      // Everyday links retain Next's native navigation, including loading,
      // cancellation and history, instead of waiting for an authored cover.
      if (document.documentElement.dataset.design === 'voyage' && !voyagePassage) {
        onNavigate?.(event)
        return
      }
      const destination = `${url.pathname}${url.search}${url.hash}`
      // The caller's handler and the route change wait until the page is
      // covered, so loading boundaries never flash beside the expanding edge.
      const request = { x, y, navigate: () => {
        let cancelled = false
        onNavigate?.({ preventDefault: () => { cancelled = true } })
        if (cancelled) return false
        router[replace ? 'replace' : 'push'](destination, { scroll, transitionTypes })
        return true
      }, fallback: () => location.assign(destination) }
      const accepted = requestFoldTransition(request) || requestP3RWipe(request)
      if (!accepted) { onNavigate?.(event); return }
      event.preventDefault()
      // The route changes under the cover; warm it now, including touch taps
      // without intent prefetch. Opted-out links keep their single request.
      if (prefetch !== false) router.prefetch(destination)
    }}
  />
}
