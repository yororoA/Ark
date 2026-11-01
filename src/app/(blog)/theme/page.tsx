import { Suspense } from 'react'
import ThemeGallery from '@/components/appearance/theme-gallery'
import { pageMetadata } from '@/lib/seo'

export const metadata = pageMetadata({
  title: '主题与外观',
  description: '选择 Ark 的视觉主题与明暗模式，让文字留在喜欢的风景里。',
  path: '/theme',
  noIndex: true,
})

export default function Page() {
  return <Suspense fallback={<div aria-busy="true" style={{ minHeight: '60vh' }} />}><ThemeGallery /></Suspense>
}
