// components/Portal.tsx
'use client'

import { ReactNode, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface PortalProps {
  children: ReactNode
  containerId?: string
  className?: string
  black?: boolean
  style?: React.CSSProperties
}

const emptySubscribe = () => () => {}

function SetPortal({
  children,
  containerId = 'portal-root',
  className,
  black = true,
  style,
  ...rest
}: PortalProps) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )

  if (!mounted) return null

  const container = document.getElementById(containerId)
  if (!container) return null

  return createPortal(
    <div className={cn(black && 'bg-black/20', className)} style={style} {...rest}>
      {children}
    </div>,
    container,
  )
}

export default function Portal(props: PortalProps) {
  return (
    <SetPortal
      className={cn('fixed inset-0 z-[9998] min-h-screen min-w-screen', props.className)}
      black={props.black}
      style={props.style}
    >
      {props.children}
    </SetPortal>
  )
}
