// Shared liquid outline for the P3R page wipe and menu. A few slow, drifting
// harmonics read as water rather than a gear; weights sum to 1.
const TAU = Math.PI * 2
const HARMONICS = [[2, .5, .0012], [3, .32, -.0019], [5, .18, .0027]] as const
// Largest radial deviation as a fraction of the radius.
export const FLUID_EDGE = .085

export type FluidSeed = readonly number[]

// Fresh phases keep consecutive effects from repeating one silhouette.
export const fluidSeed = (): FluidSeed => HARMONICS.map(() => Math.random() * TAU)

// Radius multiplier at an angle; time is in milliseconds.
export function fluidScale(angle: number, time: number, seed: FluidSeed) {
  let wave = 0
  for (let index = 0; index < HARMONICS.length; index++) {
    const [frequency, weight, drift] = HARMONICS[index]
    wave += weight * Math.sin(frequency * angle + seed[index] + drift * time)
  }
  return 1 + FLUID_EDGE * wave
}

// Every lobe of the outline still clears the farthest viewport corner.
export function fluidCoverRadius(x: number, y: number, width: number, height: number) {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) / (1 - FLUID_EDGE) + 12
}

// Pixel vertices for CSS polygon() / path() clips. At viewport radii a 64-gon
// stays within about 2px of the smooth curve.
export function fluidPoints(x: number, y: number, radius: number, time: number, seed: FluidSeed, segments = 64) {
  return Array.from({ length: segments }, (_, index): [number, number] => {
    const angle = index / segments * TAU
    const extent = Math.max(0, radius * fluidScale(angle, time, seed))
    return [x + Math.cos(angle) * extent, y + Math.sin(angle) * extent]
  })
}
