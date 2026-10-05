import Notices from '@/components/blog/notices'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: '公告',
  description: 'YororoIce Ark 的站点公告与历史记录。',
  path: '/notice',
})
export default function Page() { return <Notices /> }
