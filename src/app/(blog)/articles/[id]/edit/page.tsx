import { notFound } from 'next/navigation'
import { ArticleEditor } from '@/components/blog/articles'

export const metadata = { title: '编辑文章' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[a-f0-9]{24}$/.test(id)) notFound()
  return <ArticleEditor id={id} />
}
