'use client'

import Image from "next/image"
import { useBrightness } from "@/context/brightness-context"

export default function BgImage() {
  const { isDimmed } = useBrightness()

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
