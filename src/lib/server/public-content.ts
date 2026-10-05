import 'server-only'

import { cache } from 'react'
import type { Entry, Envelope } from '@/lib/blog'
import { backendUrl } from './blog-session'

const CONTENT_REVALIDATE_SECONDS = 300

class PublicContentError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function publicEnvelope<T>(path: string, fresh = false): Promise<Envelope<T>> {
  const cacheOptions = fresh
    ? { cache: 'no-store' as const }
    : { next: { revalidate: CONTENT_REVALIDATE_SECONDS, tags: ['public-blog-content'] } }
  const response = await fetch(backendUrl(`/api/${path}`), {
    ...cacheOptions,
    signal: AbortSignal.timeout(30_000),
  })
  const payload = await response.json().catch(() => null) as (Envelope<T> & { message?: string; success?: boolean }) | null

  if (!response.ok || !payload || payload.success === false) {
    throw new PublicContentError(payload?.message || `博客服务响应异常 (${response.status})`, response.status)
  }

  return payload
}

export const getArticlesPage = cache(async (
  page = 1,
  limit = 10,
  keyword = '',
  category = '',
  date = '',
) => {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  })
  if (keyword) query.set('keyword', keyword)
  if (category) query.set('category', category)
  if (date) query.set('date', date)
  return publicEnvelope<Entry[]>(`knowledge?${query}`)
})

export const getAllArticles = cache(async () => {
  const first = await getArticlesPage(1, 100)
  const pages = first.pagination?.pages || 1
  const remainder = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, index) => getArticlesPage(index + 2, 100)),
  )
  return [...first.data, ...remainder.flatMap(result => result.data)]
})

export const getArticle = cache(async (id: string) => {
  try {
    const result = await publicEnvelope<Entry>(`knowledge/${id}?trackView=false`, true)
    return result.data
  } catch (error) {
    if (error instanceof PublicContentError && error.status === 404) return null
    throw error
  }
})

export const getPublishedMoments = cache(async () => {
  const result = await publicEnvelope<Entry[]>('moments/get?isEditing=false')
  return result.data
})

export const getPublishedMomentsPage = cache(async (page = 1, limit = 12, date = '') => {
  const query = new URLSearchParams({
    isEditing: 'false',
    page: String(page),
    limit: String(limit),
  })
  if (date) query.set('date', date)
  return publicEnvelope<Entry[]>(`moments/get?${query}`)
})

export const getMoment = cache(async (id: string) => {
  try {
    const result = await publicEnvelope<Entry>(`moments/${id}`, true)
    return result.data
  } catch (error) {
    if (error instanceof PublicContentError && error.status === 404) return null
    throw error
  }
})
