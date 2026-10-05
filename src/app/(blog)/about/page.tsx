import About from '@/components/blog/about'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: '关于',
  description: '了解 YororoIce、技术方向、兴趣与这个个人博客。',
  path: '/about',
})
export default function Page() { return <About /> }
