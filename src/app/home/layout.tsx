import { Metadata } from 'next';

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
    <div className='h-screen w-screen perspective-[2000px]'>
      {children}
    </div>
  );
}
