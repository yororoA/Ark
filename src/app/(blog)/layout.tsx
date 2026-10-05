import type { Metadata } from 'next'
import BlogShell from '@/components/blog/blog-shell'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo'

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
}
export default function Layout({ children }: { children: React.ReactNode }) { return <BlogShell>{children}</BlogShell> }
