import { Metadata } from 'next';
import { NO_INDEX } from '@/lib/seo';

export const metadata: Metadata = {
  title: "登录",
  description: "登录 YororoIce Ark。",
  robots: NO_INDEX,
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className='min-h-svh flex flex-col relative items-center justify-between overflow-x-clip'>
      {children}
    </div>
  );
}
