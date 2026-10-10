import "@/styles/globals.scss";
import "@/app/global.css";
import "@/styles/appearance.scss";
import type { Metadata } from 'next';
import { cn } from "@/lib/utils";
import BgImage from "@/components/arks/bg-image";
import RouteScrollManager from "@/components/route-scroll-manager";
import AppearanceBootstrap from "@/components/appearance/appearance-bootstrap";
import { AppearanceObserver } from "@/components/appearance/appearance-store";
import RainConnectionBoundary from "@/components/appearance/rain-connection-boundary";
import P3REffects from "@/components/appearance/p3r-effects";
import WebMascot from "@/components/mascot/web-mascot";
import StructuredData from "@/components/seo/structured-data";
import { DEFAULT_SOCIAL_IMAGE, SITE_AUTHOR, SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo";

// ------------------------------------ 字体配置 ------------------------------------
import { Barlow_Condensed, Gowun_Batang, IBM_Plex_Sans, Noto_Serif_SC, Noto_Sans_SC, Orbitron } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';

const barlowCondensed = Barlow_Condensed({
  weight: '800',
  style: 'italic',
  subsets: ['latin'],
  variable: '--font-barlow-condensed',
  display: 'swap',
  preload: false,
});

// Demand-load Unicode subsets. Preloading this family expands into dozens of
// unused Korean font files in the production manifest.
const gowunBatang = Gowun_Batang({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-gowun-batang-loaded',
  display: 'swap',
  preload: false,
});
// ibm - 登录下方免责声明
const ibmPlexSans = IBM_Plex_Sans({
  weight: ['400', '700'],       // 声明字重
  subsets: ['latin'],            // 声明字符子集
  variable: '--font-ibm-plex-loaded',   // 自定义 CSS 变量名
  display: 'swap',
});
// 宋体 - 登录按钮
const notoSerifSC = Noto_Serif_SC({
  // One variable face per Unicode subset covers regular and bold.
  subsets: ['latin'],
  variable: '--font-noto-serif-loaded', // 定义 CSS 变量名
  display: 'swap',
  preload: false,
});
// 等线 - 免责声明
const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  variable: '--font-noto-sans-loaded',
  display: 'swap',
  preload: false,
})

// 登录进度条数字
const orbitron = Orbitron({
  subsets: ['latin'],
  variable: '--font-orbitron-loaded',
  display: 'swap',
  preload: false,
});

// -------------------------------------------------------------------------------
export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_AUTHOR, url: absoluteUrl('/about') }],
  creator: SITE_AUTHOR,
  publisher: SITE_AUTHOR,
  keywords: ['YororoIce', '个人博客', '编程', '前端开发', '摄影', '生活记录'],
  referrer: 'origin-when-cross-origin',
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: absoluteUrl('/home'),
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_SOCIAL_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_SOCIAL_IMAGE.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const siteStructuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': absoluteUrl('/#website'),
    url: absoluteUrl('/home'),
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    inLanguage: 'zh-CN',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': absoluteUrl('/about#person'),
    name: SITE_AUTHOR,
    url: absoluteUrl('/about'),
    sameAs: [
      'https://github.com/yororoA',
      'https://x.com/yororo_ice',
      'https://space.bilibili.com/411513480',
    ],
  },
]


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      data-design="archive"
      data-theme="system"
      className={cn(gowunBatang.variable, ibmPlexSans.variable, notoSerifSC.variable, notoSansSC.variable, orbitron.variable, barlowCondensed.variable, "font-sans")}
      suppressHydrationWarning
    >
      <head>
        <AppearanceBootstrap />
        <StructuredData data={siteStructuredData} />
      </head>
      <body className="min-h-screen flex flex-col relative">
        <AppearanceObserver />
        <P3REffects />
        <RouteScrollManager />
        <div id="portal-root" />
        <BgImage />
        <RainConnectionBoundary>{children}</RainConnectionBoundary>
        <WebMascot />
        <Analytics />
      </body>
    </html>
  );
}
