'use client'

import Image from "next/image"
import { usePathname } from "next/navigation"

export default function BgImage() {
  const pathname = usePathname()
  // The current blog and login flows own their backgrounds. The previous
  // photographic login backdrop remains available in commit 26f4085.
  if (!pathname.startsWith('/test')) return null

  return (
    <Image
      src="/bg.jpg"
      alt="bg"
      fill={true}
      loading="eager"
      className="absolute top-0 left-0 w-full h-full object-cover"
    />
  )
}
