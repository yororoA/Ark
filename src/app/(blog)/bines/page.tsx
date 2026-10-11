import Bines from '@/components/blog/bines'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: 'Bines',
  description: 'Bines 的独立站内身份、片刻与日常对话。',
  path: '/bines',
})

export default function Page() { return <Bines /> }
