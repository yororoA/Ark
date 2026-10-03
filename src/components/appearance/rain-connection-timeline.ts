export const RAIN_TIMING = { orbit: 4400, cover: 750, close: 1350, fade: 240 } as const

export const smooth = (value: number) => {
  const t = Math.min(1, Math.max(0, value))
  return t * t * (3 - 2 * t)
}
