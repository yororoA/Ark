// Original geometry informed by BV15V4y117GZ's intro, not traced video frames.
// The earlier parallel-column composition remains in commit 439b851.
type Point = readonly [number, number]
type Paint = string | CanvasGradient
type Context = CanvasRenderingContext2D

export const WATER_ENTRY_MS = 1750
export const WATER_REVEAL_MS = 760
const TAU = Math.PI * 2
export const clamp = (n: number) => Math.min(1, Math.max(0, n))
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }
const seed = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

// Closed quadratic contours keep lobes connected, with occasional sharp
// notches. Reusing these unit contours avoids random geometry on every frame.
const contours: Point[][] = Array.from({ length: 16 }, (_, id) =>
  Array.from({ length: 20 }, (_, i) => {
    const angle = TAU * i / 20
    const radius = .79 + seed(id * 37 + i) * .3 + Math.sin(angle * 3 + id) * .14
    return [Math.cos(angle) * radius, Math.sin(angle) * radius] as const
  }),
)
const bubbles = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  side: i % 2 ? 1 : -1,
  born: .16 + seed(i + 81) * .29,
  depth: .15 + seed(i + 43) * .8,
  offset: i % 3 === 0 ? .22 + seed(i + 12) * .36 : .8 + seed(i + 12) * .47,
  radius: .003 + Math.pow(seed(i + 5), 3) * .028,
  drift: seed(i + 93),
}))

function contour(ctx: Context, points: readonly Point[]) {
  const last = points[points.length - 1], first = points[0]
  ctx.moveTo((last[0] + first[0]) / 2, (last[1] + first[1]) / 2)
  for (let i = 0; i < points.length; i++) {
    const current = points[i], next = points[(i + 1) % points.length]
    ctx.quadraticCurveTo(current[0], current[1], (current[0] + next[0]) / 2, (current[1] + next[1]) / 2)
  }
  ctx.closePath()
}

function blob(ctx: Context, x: number, y: number, rx: number, ry: number, id: number, paint: Paint, rotation = 0, hollow = false) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.scale(rx, ry)
  ctx.beginPath()
  const points = contours[id % contours.length]
  contour(ctx, points)
  if (hollow) {
    // An offset, uneven hole makes thick foam rims rather than thin ellipses.
    ctx.translate(.06, -.04)
    ctx.scale(.55, .67)
    contour(ctx, points)
  }
  ctx.fillStyle = paint
  ctx.fill('evenodd')
  ctx.restore()
}

function depthGradient(ctx: Context, h: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0, '#0de2ed')
  gradient.addColorStop(.26, '#078eef')
  gradient.addColorStop(.64, '#064adb')
  gradient.addColorStop(1, '#1005ae')
  return gradient
}

function caustics(ctx: Context, w: number, h: number, drift = 0) {
  // Flattened, connected patches cluster at the surface and diminish with
  // depth, like light seen from below water. No full-screen concentric rings.
  for (let row = 0; row < 8; row++) {
    const depth = row / 8
    const y = h * (.012 + depth * depth * .23)
    const count = 14 - row
    ctx.fillStyle = row % 3 ? '#77f9f6' : '#16eaf0'
    ctx.globalAlpha = .48 * (1 - depth)
    for (let col = 0; col < count; col++) {
      const id = row * 23 + col
      const x = w * ((col + seed(id) * .7) / count) + Math.sin(id + drift) * w * .012
      const rx = w * (.024 + seed(id + 31) * .045) * (1 - depth * .65)
      blob(ctx, x, y + Math.sin(col * 1.3 + drift) * h * .012, rx, h * (.007 + seed(id + 8) * .009) * (1 - depth * .5), id, ctx.fillStyle, -.1)
    }
  }
  ctx.globalAlpha = 1
}

export function underwater(ctx: Context, w: number, h: number) {
  ctx.fillStyle = depthGradient(ctx, h)
  ctx.fillRect(0, 0, w, h)
  caustics(ctx, w, h)
}

function pebble(ctx: Context, x: number, y: number, size: number, t: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(.3 + t * 3)
  ctx.scale(size, size)
  ctx.fillStyle = '#e3f3ff'
  ctx.strokeStyle = '#032369'
  ctx.lineWidth = .07
  ctx.beginPath()
  ctx.moveTo(-.72, -.4); ctx.lineTo(-.1, -.9); ctx.lineTo(.65, -.62)
  ctx.lineTo(.9, .1); ctx.lineTo(.24, .95); ctx.lineTo(-.6, .58)
  ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.fillStyle = '#82aaca'
  ctx.beginPath(); ctx.moveTo(-.6, .58); ctx.lineTo(.04, -.12); ctx.lineTo(.9, .1)
  ctx.lineTo(.24, .95); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath(); ctx.moveTo(-.72, -.4); ctx.lineTo(-.1, -.9); ctx.lineTo(.04, -.12)
  ctx.closePath(); ctx.fill()
  ctx.restore()
}

export function entry(ctx: Context, w: number, h: number, t: number) {
  const size = Math.min(w, h)
  const plunge = smooth((t - .1) / .48)
  const expansion = smooth((t - .35) / .39)
  const settle = smooth((t - .67) / .33)
  const foamAlpha = 1 - smooth((t - .52) / .38)
  const tip = -size * .07 + h * (1.46 * plunge + .9 * expansion)
  // The reference's pale opening field is essential to the silhouette.
  // Lift the existing page once, then let the blue cavity replace it.
  const exposure = smooth((t - .08) / .14) * (1 - smooth((t - .5) / .2))
  if (exposure > 0) {
    ctx.fillStyle = `rgba(248,253,255,${exposure * .98})`
    ctx.fillRect(0, 0, w, h)
  }
  const top = -h * .26
  const spread = w * (.02 + plunge * .42 + expansion * .8)
  const axis = (u: number) => w * (.51 + Math.sin(u * 2.5) * .026 + expansion * .02)
  const halfWidth = (u: number) => spread * Math.pow(Math.max(0, 1 - u), .62)
  const edge = (u: number, side: number): Point => {
    const rough = 1 + Math.sin(u * 24 + side * 2 + t * 4) * .048
      + Math.sin(u * 67 - t * 3 + side) * .022
    return [axis(u) + side * halfWidth(u) * rough, top + (tip - top) * u]
  }

  if (t > .1) {
    // One pressure cavity, broad at the surface and narrow at the falling
    // object. All foam/particles share this flow; none are separate waterfalls.
    ctx.beginPath()
    for (const side of [-1, 1]) for (let i = 0; i <= 64; i++) {
      const [x, y] = edge(side < 0 ? i / 64 : 1 - i / 64, side)
      if (side < 0 && i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.save()
    ctx.clip()
    ctx.globalAlpha = .87 + .13 * expansion
    ctx.fillStyle = depthGradient(ctx, h)
    ctx.fillRect(0, 0, w, h)
    ctx.globalAlpha = 1
    caustics(ctx, w, h, t * 1.4)

    // Unequal pale tongues stretch down inside the blue cavity. Their tapered
    // ends, deep notches and bulging shoulders come from independent contours.
    const tongues = [
      { x: -.74, width: .19, end: .92, phase: .3 },
      { x: -.19, width: .13, end: .96, phase: 2.5 },
      { x: .36, width: .17, end: .59, phase: 4.3 },
      { x: .89, width: .2, end: .84, phase: 6.1 },
    ]
    ctx.globalAlpha = foamAlpha
    for (const [index, tongue] of tongues.entries()) {
      const points: Point[] = []
      for (const side of [-1, 1]) for (let i = 0; i <= 44; i++) {
        const v = side < 0 ? i / 44 : 1 - i / 44
        const u = v * tongue.end
        const y = top + (tip - top) * u - settle * h * .9
        const bend = Math.sin(v * 7 + tongue.phase + t * 3) * spread * .036
        const center = axis(u) + tongue.x * halfWidth(u) + bend
        const shoulder = 1 + Math.sin(v * 18 + tongue.phase) * .25 + Math.sin(v * 49 + tongue.phase + side) * .24
        const width = spread * tongue.width * Math.pow(1 - v, 1.7) * shoulder
        points.push([center + side * width, y])
      }
      ctx.beginPath()
      contour(ctx, points)
      ctx.fillStyle = index % 2 ? '#c4ffff' : '#a4faf8'
      ctx.fill()
      // Scalloped shoulders and overlapping lobes attach to the water, rather
      // than floating as unrelated dots. Wider crests stay near the surface.
      for (let lobe = 0; lobe < 5; lobe++) {
        const u = .06 + lobe * .042
        const x = axis(u) + tongue.x * halfWidth(u) + Math.sin(lobe * 2 + index) * spread * .07
        const y = top + (tip - top) * u - settle * h * .9
        const radius = spread * (.054 + seed(index * 8 + lobe) * .05) * (1 - u)
        blob(ctx, x, y, radius * 1.5, radius, index * 5 + lobe, index % 2 ? '#c4ffff' : '#a4faf8', -.3)
      }
    }
    ctx.restore()

    // Large foam collars cling to both banks. Holes preserve blue pockets and
    // leave the pressure cavity readable instead of covering it with confetti.
    for (let i = 0; i < 18; i++) {
      const side = i % 2 ? 1 : -1
      const u = .11 + seed(i + 61) * .74
      const [x, y] = edge(u, side)
      const growth = smooth((t - .17 - seed(i) * .13) / .18)
      const radius = Math.min(spread * .25, size * (.034 + seed(i + 20) * .075)) * growth
      if (radius < .5) continue
      ctx.globalAlpha = foamAlpha * .9
      blob(ctx, x, y - settle * h * .85, radius * 1.25, radius, i, '#91f8fa', side * .4, i % 3 === 0)
      blob(ctx, x - side * radius * .15, y - settle * h * .85 - radius * .08, radius, radius * .85, i, '#bcffff', side * .4, i % 3 === 0)
    }
    ctx.globalAlpha = 1
  }

  for (const bubble of bubbles) {
    const age = (t - bubble.born) / .55
    if (age <= 0 || age >= 1) continue
    const [bankX, bankY] = edge(bubble.depth, bubble.side)
    const x = axis(bubble.depth) + (bankX - axis(bubble.depth)) * bubble.offset
      + bubble.side * age * size * .12 * bubble.drift
    const y = bankY - age * h * (.15 + bubble.drift * .2)
    const radius = size * bubble.radius * (.6 + smooth(age * 5) * .4)
    if (y < -radius || y > h + radius || x < -radius || x > w + radius) continue
    ctx.globalAlpha = (1 - smooth((age - .55) / .45)) * foamAlpha
    blob(ctx, x + radius * .13, y + radius * .05, radius * 1.15, radius * 1.13, bubble.id, '#2785ed', bubble.drift, bubble.id % 4 !== 0)
    blob(ctx, x, y, radius, radius, bubble.id, bubble.id % 3 ? '#a0fbfa' : '#4ce3f4', bubble.drift, bubble.id % 4 !== 0)
    if (bubble.id % 4 === 0) {
      blob(ctx, x - radius * .2, y - radius * .2, radius * .5, radius * .55, bubble.id + 1, '#cfffff')
    }
  }
  ctx.globalAlpha = 1

  if (tip < h + size * .06) {
    pebble(ctx, axis(1), tip, Math.max(12, size * .022), t)
  }
  // A monotonic dissolve to the identical held frame closes every transparent
  // gap before routing; it never briefly exposes the login page again.
  if (settle > 0) {
    ctx.save()
    ctx.globalAlpha = settle
    // Render the held frame through one alpha, not one alpha per caustic.
    ctx.fillStyle = depthGradient(ctx, h)
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
    ctx.save()
    // caustics manages its own alpha, so reveal its surface band by height.
    ctx.beginPath()
    ctx.rect(0, 0, w, h * .25 * settle)
    ctx.clip()
    caustics(ctx, w, h)
    ctx.restore()
  }
}

export function reveal(ctx: Context, w: number, h: number, t: number) {
  underwater(ctx, w, h)
  const progress = smooth(t)
  const front = h * (1.06 - progress * 1.2)
  const amplitude = h * .065 * Math.sin(progress * Math.PI)
  const edge = (x: number) => front + amplitude * (Math.sin(x / w * 9 + .4) + Math.sin(x / w * 23) * .22)
  ctx.beginPath()
  ctx.moveTo(0, h + 1)
  for (let i = 0; i <= 80; i++) {
    const x = i / 80 * w
    ctx.lineTo(x, edge(x))
  }
  ctx.lineTo(w, h + 1)
  ctx.closePath()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = Math.sin(progress * Math.PI) * .75
  for (let i = 0; i < 28; i++) {
    const x = w * i / 27
    const radius = Math.min(w, h) * (.008 + seed(i) * .019)
    blob(ctx, x, edge(x), radius * 2.4, radius * .4, i, '#b0ffff', -.1)
  }
  ctx.globalAlpha = 1
}
