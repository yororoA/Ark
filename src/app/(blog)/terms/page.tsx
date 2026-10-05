import Notices from '@/components/blog/notices'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: '社区约定',
  description: 'YororoIce Ark 的社区互动与内容发布约定。',
  path: '/terms',
})
export default function Page() { return <Notices terms /> }
