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
    return () => setMounted(false)
  }, [])

  if (!mounted) return null

  let container = document.getElementById(containerId)
  if (!container) {
    container = document.createElement('div')
    container.id = containerId
    document.body.appendChild(container)
  }

  container.className = className ?? ''

  return createPortal(children, container)
}

export default function Portal(props: PortalProps) {
  return (
    <SetPortal className={cn('fixed inset-0 z-[9999] min-h-screen min-w-screen bg-black/20', props.className)} >
      {props.children}
    </SetPortal >
  );
}
