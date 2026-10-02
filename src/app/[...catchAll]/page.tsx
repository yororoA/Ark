import { notFound, permanentRedirect } from 'next/navigation'
import { legacyDestination } from '@/lib/legacy-route'

// The previous timed 404 remains in origin/main (ffc45dd). Unknown links now
// return a real not-found page; known old blog links retain their query values.
export default async function Page({ params, searchParams }: {
  params: Promise<{ catchAll: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { catchAll } = await params
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item)
  }
  const destination = legacyDestination(`/${catchAll.join('/')}`, query)
  if (destination) permanentRedirect(destination)
  notFound()
}
