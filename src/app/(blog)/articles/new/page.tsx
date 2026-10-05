import { ArticleEditor } from '@/components/blog/articles'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: '写文章', robots: NO_INDEX }
export default function Page() { return <ArticleEditor /> }
