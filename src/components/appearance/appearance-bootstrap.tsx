'use client'

import { APPEARANCE_BOOTSTRAP } from '@/lib/appearance'

export default function AppearanceBootstrap() {
  return (
    <script
      id="ark-appearance"
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOTSTRAP }}
    />
  )
}
