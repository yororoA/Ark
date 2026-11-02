export const FOLD_TIMING = {
  crease: 650,
  opening: 1450,
  approach: 3900,
  covered: 4600,
  reveal: 850,
  quickReveal: 140,
} as const

export const clamp = (value: number) => Math.max(0, Math.min(1, value))
export const progress = (value: number, start: number, end: number) => clamp((value - start) / (end - start))
export const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t) }
export const mix = (a: number, b: number, t: number) => a + (b - a) * t
