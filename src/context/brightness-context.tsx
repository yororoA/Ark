'use client'
/* 背景图亮度上下文 */
import { createContext, useContext, useState, ReactNode } from 'react'

interface BrightnessContextType {
  isDimmed: boolean
  setDimmed: (v: boolean) => void
}

const BrightnessContext = createContext<BrightnessContextType>({
  isDimmed: false,
  setDimmed: () => {},
})

export function BrightnessProvider({ children }: { children: ReactNode }) {
  const [isDimmed, setDimmed] = useState(false)

  return (
    <BrightnessContext.Provider value={{ isDimmed, setDimmed }}>
      {children}
    </BrightnessContext.Provider>
  )
}

export function useBrightness() {
  return useContext(BrightnessContext)
}
