'use client'

import Image from "next/image"
import { useBrightness } from "@/context/brightness-context"
import { usePathname } from "next/navigation"

export default function BgImage() {
  const { isDimmed } = useBrightness()
  const pathname = usePathname()
  // 博客使用自己的纸色背景，保留登录页现有图像与过渡。
  if (!pathname.startsWith('/login') && !pathname.startsWith('/test')) return null

  return (
    <Image
      src="/bg.jpg"
      alt="bg"
      fill={true}
      loading="eager"
      className={`absolute top-0 left-0 w-full h-full object-cover ${isDimmed ? 'brightness-60' : 'brightness-100'}`}
    />
  )
}
