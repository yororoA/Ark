import { Metadata } from 'next';
import "@/styles/globals.scss";
import "@/app/global.css";
import Image from "next/image";
import { cn } from "@/lib/utils";

// ------------------------------------ 字体配置 ------------------------------------
import { Gowun_Batang, IBM_Plex_Sans, Noto_Serif_SC, Noto_Sans_SC } from 'next/font/google';
// Batang - 登录页黑条 tag
const gowunBatang = Gowun_Batang({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-gowun-batang',
  display: 'swap',
});
// ibm - 登录下方免责声明
const ibmPlexSans = IBM_Plex_Sans({
  weight: ['400', '700'],       // 声明字重
  subsets: ['latin'],            // 声明字符子集
  variable: '--font-ibm-plex',   // 自定义 CSS 变量名
  display: 'swap',
});
// 宋体 - 登录按钮
const notoSerifSC = Noto_Serif_SC({
  weight: ['400', '700'],       // 导入常规体和粗体
  subsets: ['latin'],            // 声明子集（Next.js 会自动对中文进行按需分包优化）
  variable: '--font-noto-serif', // 定义 CSS 变量名
  display: 'swap',
});
// 等线 - 免责声明
const notoSansSC = Noto_Sans_SC({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-noto-sans',
  display: 'swap',
})

// -------------------------------------------------------------------------------
export const metadata: Metadata = {
  title: "YororoIce Ark",
  description: "...",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html
      lang="zh-CN"
      className={cn(gowunBatang.variable, ibmPlexSans.variable, notoSerifSC.variable, notoSansSC.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col relative">
        <div id="portal-root" />
        <Image
          src="/bg.jpg"
          alt="bg"
          fill={true}
          loading="eager"
          className="absolute top-0 left-0 w-full h-full object-cover"
        />
        {children}
      </body>
    </html>
  );
}
