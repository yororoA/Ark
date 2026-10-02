import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { MomentList } from '@/components/blog/moments'
import { legacyDestination, legacySearchParams, type LegacyQuery } from '@/lib/legacy-route'

export const metadata = { title: '片刻' }
export default async function Page({ searchParams }: { searchParams: Promise<LegacyQuery> }) {
  const query = legacySearchParams(await searchParams)
  const mid = query.get('mid')
  if (mid && /^[a-f0-9]{24}$/.test(mid)) redirect(legacyDestination('/moments', query)!)
  return <Suspense><MomentList /></Suspense>
}
