import { Suspense } from 'react'
import Chat from '@/components/blog/chat'
import { NO_INDEX } from '@/lib/seo'

export const metadata = {
  title: '通信',
  description: 'YororoIce Ark 站内通信。',
  robots: NO_INDEX,
}
export default function Page() { return <Suspense><Chat /></Suspense> }
