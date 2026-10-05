import { notFound } from 'next/navigation'
import { ArticleEditor } from '@/components/blog/articles'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: '编辑文章', robots: NO_INDEX }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-f0-9]{24}$/.test(id)) notFound()
  return <ArticleEditor id={id} />
}
