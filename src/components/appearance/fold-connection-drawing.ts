import { FOLD_TIMING as T, mix, progress, smooth } from './fold-connection-timeline'

type Point = [number, number]
type Vertex = [number, number, number]
export type FoldPalette = { paper: string; carbon: string; slate: string; mist: string; signal: string }

function polygon(context: CanvasRenderingContext2D, points: Point[], color: string) {
  if (points.length < 3) return
  context.beginPath()
  points.forEach(([x, y], index) => { if (index) context.lineTo(x, y); else context.moveTo(x, y) })
  context.closePath(); context.fillStyle = color; context.fill()
  // Shared edges slightly overlap to avoid pale antialiasing cracks.
  context.strokeStyle = color; context.lineWidth = .6; context.stroke()
}

// Clip paper faces before perspective projection; crossing a leaf never draws
// inverted or infinitely large polygons behind the camera.
function nearClip(vertices: Vertex[], camera: number): Vertex[] {
  const near = camera + .35
  const output: Vertex[] = []
  vertices.forEach((a, index) => {
    const b = vertices[(index + 1) % vertices.length]
    const insideA = a[2] >= near, insideB = b[2] >= near
    if (insideA) output.push(a)
    if (insideA !== insideB) {
      const t = (near - a[2]) / (b[2] - a[2])
      output.push([mix(a[0], b[0], t), mix(a[1], b[1], t), near])
    }
  })
  return output
}

function corridor(context: CanvasRenderingContext2D, width: number, height: number, time: number, p: FoldPalette) {
  const travel = smooth(progress(time, 1080, T.approach))
  const camera = mix(-4, 70.8, travel)
  const cx = width * (.5 + .022 * Math.sin(travel * Math.PI * 2))
  const cy = height * mix(.47, .5, travel)
  const focal = Math.max(width * .65, height * .82)
  const roll = Math.sin(travel * Math.PI) * -.045
  const project = (vertices: Vertex[], color: string) => {
    const clipped = nearClip(vertices, camera)
    polygon(context, clipped.map(([x, y, z]) => {
      const ratio = focal / (z - camera)
      const dx = x * ratio, dy = (y - .3) * ratio
      return [cx + dx * Math.cos(roll) - dy * Math.sin(roll), cy + dx * Math.sin(roll) + dy * Math.cos(roll)]
    }), color)
  }
  // The two long ground folds remain continuous as the view travels forward.
  project([[-24, 4, -5], [-3, 4, 82], [0, 4, 82], [-6, 4, -5]], p.slate)
  project([[3, 4, 82], [24, 4, -5], [8, 4, -5], [.7, 4, 82]], p.mist)
  project([[-6, 4, -5], [0, 4, 82], [.7, 4, 82], [-1, 4, -5]], p.carbon)
  // A cut-red destination. The narrow unprinted hinge stays legible up close.
  project([[-1.55, -3.4, 76], [1.55, -3.4, 76], [1.55, 4, 76], [-1.55, 4, 76]], p.signal)
  project([[-.055, -3.4, 75.98], [.04, -3.4, 75.98], [.12, 4, 75.98], [-.04, 4, 75.98]], p.paper)
  project([[1.55, -3.4, 76], [1.85, -3.65, 77], [1.85, 4, 77], [1.55, 4, 76]], p.carbon)
  // Five large, deliberately unequal folded frames. Each has a broad face,
  // a pale turned edge and an open paper centre; no wireframe or material sheen.
  for (let index = 4; index >= 0; index--) {
    const z = 8 + index * 13.2
    const turn = index % 2 ? -1 : 1
    const x = turn * .35
    const y = index % 2 ? -.25 : .15
    const face = (points: Point[], color: string, depth = 0) => project(points.map(([px, py]) => [px + x, py + y, z + depth]), color)
    face([[-5.8, -4.5], [4.8, -4.5], [3.1, -2.65], [-2.7, -2.65]], p.carbon)
    face([[-5.8, -4.5], [-2.7, -2.65], [-2.7, 3.2], [-5.2, 4.6]], index % 2 ? p.slate : p.carbon)
    face([[3.1, -2.65], [4.8, -4.5], [5.6, 4.6], [3.1, 3.2]], index % 2 ? p.carbon : p.slate)
    face([[-5.2, 4.6], [-2.7, 3.2], [3.1, 3.2], [5.6, 4.6]], p.carbon)
    project([[-2.7+x,-2.65+y,z],[-2.3+x,-2.3+y,z+1.5],[-2.3+x,2.8+y,z+1.5],[-2.7+x,3.2+y,z]], p.mist)
    project([[3.1+x,-2.65+y,z],[2.7+x,-2.3+y,z+1.5],[-2.3+x,-2.3+y,z+1.5],[-2.7+x,-2.65+y,z]], p.slate)
    project([[3.1+x,3.2+y,z],[2.7+x,2.8+y,z+1.5],[2.7+x,-2.3+y,z+1.5],[3.1+x,-2.65+y,z]], p.mist)
    // Asymmetric long tabs give the passage a cut-paper silhouette.
    face([[-5.8,-4.5],[-7,-5.6],[-5.9,3],[-5.2,4.6]], p.mist, 1.2)
    face([[4.8,-4.5],[6.2,-3.2],[6.9,2],[5.6,4.6]], p.carbon, 1.3)
  }
}

// Real alpha between the departing leaves reveals the destination DOM.
function leaves(context: CanvasRenderingContext2D, width: number, height: number, open: number, p: FoldPalette, backs = true) {
  const t = smooth(open), diagonal = width * .16 * Math.sin(t * Math.PI)
  const travel = width * .91 * t
  const leftTop = width / 2 - travel + diagonal
  const leftBottom = width / 2 - travel - diagonal
  const rightTop = width / 2 + travel + diagonal
  const rightBottom = width / 2 + travel - diagonal
  polygon(context, [[-width,-height],[leftTop,-height],[leftBottom,height*2],[-width,height*2]], p.paper)
  polygon(context, [[rightTop,-height],[width*2,-height],[width*2,height*2],[rightBottom,height*2]], p.paper)
  if (backs && t > 0 && t < 1) {
    const lip = width * .16 * Math.sin(Math.PI * t)
    polygon(context, [[leftTop,-height],[leftTop-lip,-height],[leftBottom-lip*.2,height*2],[leftBottom,height*2]], p.carbon)
    polygon(context, [[rightTop,-height],[rightTop+lip*.25,-height],[rightBottom+lip,height*2],[rightBottom,height*2]], p.mist)
  }
}

export function drawFoldConnection(context: CanvasRenderingContext2D, width: number, height: number, time: number, reveal: number, p: FoldPalette) {
  context.clearRect(0, 0, width, height)
  if (reveal > 0) { leaves(context, width, height, reveal, p); return }
  context.fillStyle = p.paper; context.fillRect(0, 0, width, height)
  if (time >= T.covered) {
    polygon(context, [[width*.5-2,height*.44],[width*.5+2,height*.44],[width*.5+2,height*.56],[width*.5-2,height*.56]], p.signal)
    return
  }
  if (time > T.crease) {
    corridor(context, width, height, time, p)
    const opening = smooth(progress(time, T.crease, T.opening))
    if (opening < 1) leaves(context, width, height, opening, p)
    const closing = smooth(progress(time, T.approach, T.covered))
    if (closing > 0) leaves(context, width, height, 1 - closing, p)
  }
  if (time < T.opening) {
    const line = smooth(progress(time, 0, T.crease))
    const departure = smooth(progress(time, T.crease, T.opening))
    const x = width * .5 + width * .8 * departure
    const from = height * .14
    const to = from + height * .72 * line
    const kink = height * .48
    context.strokeStyle = p.signal; context.lineWidth = Math.max(2, width / 560); context.lineJoin = 'miter'
    context.beginPath(); context.moveTo(x, from)
    if (to < kink) context.lineTo(x,to)
    else { context.lineTo(x,kink); context.lineTo(x-width*.035*line,to) }
    context.stroke()
  }
}
