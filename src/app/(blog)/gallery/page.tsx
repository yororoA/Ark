import Gallery from '@/components/blog/gallery'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: '映像',
  description: 'YororoIce 的摄影、图片与视频记录。',
  path: '/gallery',
})
export default function Page() { return <Gallery /> }
