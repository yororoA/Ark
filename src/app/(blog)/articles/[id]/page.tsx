import { notFound } from 'next/navigation'
import { ArticleDetail, ArticleEditor } from '@/components/blog/articles'

export const metadata = { title: '文章' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (id === 'new') return <ArticleEditor />
  if (!/^[a-f0-9]{24}$/.test(id)) notFound()
  return <ArticleDetail id={id} />
}
