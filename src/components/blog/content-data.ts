'use client'

import useSWR from 'swr'
import { Entry, Envelope } from '@/lib/blog'
import { request } from './blog-provider'

async function allArticles() {
  const first = await request<Envelope<Entry[]>>('knowledge?limit=100&page=1')
  const pages = first.pagination?.pages || 1
  const remainder = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) => request<Envelope<Entry[]>>(`knowledge?limit=100&page=${index + 2}`)))
  return [...first.data, ...remainder.flatMap(result => result.data)]
}

export function useAllArticles(enabled = true, fallbackData?: Entry[]) {
  return useSWR(enabled ? '/api/blog/archive/full-articles' : null, allArticles, {
    fallbackData,
    revalidateOnMount: !fallbackData,
  })
}
