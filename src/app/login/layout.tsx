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
    <div className='min-h-svh flex flex-col relative items-center justify-between overflow-x-clip'>
      {children}
    </div>
  );
}
