import { notFound } from 'next/navigation'
import { MomentDetail } from '@/components/blog/moments'

export const metadata = { title: '片刻' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-f0-9]{24}$/.test(id)) notFound()
  return <MomentDetail id={id} />
}
