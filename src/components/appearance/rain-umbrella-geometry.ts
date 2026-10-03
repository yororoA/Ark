export type RainPoint = readonly [number, number]

// A broad, shallow crown made from straight facets. Both the home SVG and the
// login canvas use this unit silhouette (rim y=0, half-width=1).
// The former curved silhouettes remain in commit 78da06a.
export const UMBRELLA_CROWN_HEIGHT = .46
export const UMBRELLA_SIDE_POINTS: readonly RainPoint[] = [
  [-1, 0], [-.73, -.27], [-.52, -.36], [0, -UMBRELLA_CROWN_HEIGHT],
  [.52, -.36], [.73, -.27], [1, 0],
]

export const UMBRELLA_TOP_POINTS: readonly RainPoint[] = Array.from({ length: 8 }, (_, rib) => {
  const angle = rib * Math.PI / 4 - Math.PI / 8
  return [Math.cos(angle), Math.sin(angle)] as const
})

const polygonPath = (points: readonly RainPoint[]) =>
  points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(4)} ${y.toFixed(4)}`).join('') + 'Z'

export const UMBRELLA_SIDE_PATH = polygonPath(UMBRELLA_SIDE_POINTS)
export const UMBRELLA_TOP_PATH = polygonPath(UMBRELLA_TOP_POINTS)
export const UMBRELLA_RIB_PATH = UMBRELLA_TOP_POINTS
  .map(([x, y]) => `M0 0L${x.toFixed(4)} ${y.toFixed(4)}`).join('')
