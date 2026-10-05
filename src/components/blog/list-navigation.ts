'use client'

import { useEffect } from 'react'
import type { Entry } from '@/lib/blog'

type ListKind = 'articles' | 'moments'
type StoredPosition = { path: string; y: number; at: number; returning: boolean }

const STORAGE_KEY = 'ark.blog-list-position.v1'
const MAX_AGE_MS = 30 * 60 * 1000

function readPosition(): StoredPosition | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null') as StoredPosition | null
    return value && typeof value.path === 'string' && typeof value.y === 'number' ? value : null
  } catch {
    return null
  }
}

export function listPath(kind: ListKind, params: URLSearchParams | ReadonlyURLSearchParams) {
  const query = params.toString()
  return `/${kind}${query ? `?${query}` : ''}`
}

type ReadonlyURLSearchParams = Pick<URLSearchParams, 'toString'>

export function detailPath(kind: ListKind, id: string, returnTo: string) {
  return `/${kind}/${id}?returnTo=${encodeURIComponent(returnTo)}`
}

export function safeReturnPath(value: string | null, kind: ListKind) {
  const fallback = `/${kind}`
  if (!value) return fallback
  try {
    const url = new URL(value, 'https://ark.invalid')
    return url.origin === 'https://ark.invalid' && url.pathname === fallback
      ? `${url.pathname}${url.search}`
      : fallback
  } catch {
    return fallback
  }
}

export function rememberListPosition(path: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ path, y: window.scrollY, at: Date.now(), returning: false }))
  } catch {
    // Navigation remains functional when storage is unavailable.
  }
}

export function prepareListReturn(path: string) {
  const stored = readPosition()
  if (!stored || stored.path !== path) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...stored, returning: true }))
  } catch {
    // Native navigation remains the fallback.
  }
}

export function hasPendingListReturn(path: string) {
  const stored = readPosition()
  return !!stored && stored.returning && stored.path === path && Date.now() - stored.at <= MAX_AGE_MS
}

export function useRestoreListPosition(path: string, ready: boolean) {
  useEffect(() => {
    if (!ready) return
    const stored = readPosition()
    if (!stored || !stored.returning || stored.path !== path || Date.now() - stored.at > MAX_AGE_MS) return
    let secondFrame = 0
    const firstFrame = requestAnimationFrame(() => {
      window.scrollTo({ top: stored.y, behavior: 'instant' })
      secondFrame = requestAnimationFrame(() => {
        window.scrollTo({ top: stored.y, behavior: 'instant' })
        sessionStorage.removeItem(STORAGE_KEY)
      })
    })
    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [path, ready])
}

export function newestFirst(entries: Entry[]) {
  return entries.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt) || b._id.localeCompare(a._id))
}
