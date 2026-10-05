import { NO_INDEX } from '@/lib/seo'

export const metadata = {
  title: '组件测试',
  robots: NO_INDEX,
}

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return children
}
