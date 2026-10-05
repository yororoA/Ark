import Lab from '@/components/blog/lab'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: '实验室',
  description: 'YororoIce Ark 的交互实验与创意工具。',
  path: '/lab',
})
export default function Page() { return <Lab /> }
