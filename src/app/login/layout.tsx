import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "登录 - YororoIce Ark",
  description: "用于登录",
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className='min-h-screen flex flex-col relative items-center justify-between overflow-hidden'>
      {children}
    </div>
  );
}
