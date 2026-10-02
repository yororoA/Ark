import type { Metadata } from 'next'
import BlogShell from '@/components/blog/blog-shell'

export const metadata: Metadata = { title: { default: 'YororoIce Ark', template: '%s · YororoIce Ark' }, description: '代码、日常与偶然闪过的念头。YororoIce 的个人博客。' }
export default function Layout({ children }: { children: React.ReactNode }) { return <BlogShell>{children}</BlogShell> }
