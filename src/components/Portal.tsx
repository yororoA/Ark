// components/Portal.tsx
'use client'

import { ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface PortalProps {
  children: ReactNode
  containerId?: string
  className?: string
}

function SetPortal({
  children,
  containerId = 'portal-root',
  className,
}: PortalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const container = document.getElementById(containerId)
  if (!container) return null

  return createPortal(
    <div className={className}>{children}</div>,
    container,
  )
}

export default function Portal(props: PortalProps) {
  return (
    <SetPortal className={cn('fixed inset-0 z-[9998] min-h-screen min-w-screen bg-black/20', props.className)} >
      {props.children}
    </SetPortal >
  );
}
