import { Metadata } from 'next';
import BlogShell from '@/components/blog/blog-shell';

export const metadata: Metadata = {
  title: "首页 - YororoIce Ark",
  description: "YororoIce Ark的首页",
};

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
