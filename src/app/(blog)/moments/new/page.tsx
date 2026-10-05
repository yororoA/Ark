import { MomentEditor } from '@/components/blog/moments'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: '记录片刻', robots: NO_INDEX }
export default function Page() { return <MomentEditor /> }
