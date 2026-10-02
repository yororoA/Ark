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
    <div className='relative min-h-svh w-full'>
      {children}
    </div>
  );
}
