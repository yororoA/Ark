export const RAIN_TIMING = {
  // Observed beats, measured from the first white umbrella at ~63.567s.
  // Geometry is evaluated continuously; these are not source-frame indices.
  lift: 1667,
  flash: 1800,
  chamber: 1833,
  paper: 3033,
  covered: 3367,
  reveal: 367,
  quickReveal: 200,
} as const

export const clamp = (value: number) => Math.min(1, Math.max(0, value))
export const progress = (time: number, start: number, end: number) => clamp((time - start) / (end - start))
export const lerp = (from: number, to: number, t: number) => from + (to - from) * t

export const smooth = (value: number) => {
  const t = clamp(value)
  return t * t * (3 - 2 * t)
}
