import { Suspense } from 'react'
import Chat from '@/components/blog/chat'

export const metadata = { title: '通信' }
export default function Page() { return <Suspense><Chat /></Suspense> }
