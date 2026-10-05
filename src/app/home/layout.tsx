import BlogShell from '@/components/blog/blog-shell';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: '首页',
  description: 'YororoIce 的个人博客，记录代码、日常、摄影与偶然闪过的念头。',
  path: '/home',
});

export default function HomeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <BlogShell>
      {children}
    </BlogShell>
  );
}
