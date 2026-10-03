import { RAIN_TIMING, lerp, progress, smooth } from './rain-connection-timeline'

export interface RainPalette {
  paper: string
  sheet: string
  rain: string
  deep: string
  line: string
  font: string
}

type Context = CanvasRenderingContext2D
const TAU = Math.PI * 2
// Stable seeds describe objects, not frames. No source pixels, traced paths,
// motion-capture data or external resources are used by this renderer.
const seed = (index: number) => {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453
  return value - Math.floor(value)
}

function canopy(ctx: Context, radius: number, color: string, seam: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  for (let rib = 0; rib < 8; rib++) {
    const angle = rib * TAU / 8 - Math.PI / 8
    const next = angle + TAU / 8
    const middle = angle + TAU / 16
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius
    if (rib === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
    ctx.quadraticCurveTo(
      Math.cos(middle) * radius * .89, Math.sin(middle) * radius * .89,
      Math.cos(next) * radius, Math.sin(next) * radius,
    )
  }
  ctx.closePath()
  ctx.fill()
  ctx.save()
  ctx.globalAlpha *= .2
  ctx.strokeStyle = seam
  ctx.lineWidth = .65
  ctx.beginPath()
  for (let rib = 0; rib < 8; rib++) {
    const angle = rib * TAU / 8 - Math.PI / 8
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius)
  }
  ctx.stroke()
  ctx.restore()
}

function invertedUmbrella(ctx: Context, x: number, y: number, radius: number, palette: RainPalette, tilt = 0) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(tilt)
  ctx.strokeStyle = palette.deep
  ctx.lineWidth = Math.max(1, radius * .014)
  ctx.beginPath()
  ctx.moveTo(0, radius * .28)
  ctx.lineTo(0, -radius * .85)
  ctx.bezierCurveTo(0, -radius * 1.14, radius * .2, -radius * 1.14, radius * .18, -radius * .88)
  ctx.stroke()
  ctx.fillStyle = palette.deep
  ctx.beginPath()
  ctx.moveTo(-radius, 0)
  ctx.bezierCurveTo(-radius * .61, radius * .57, radius * .61, radius * .57, radius, 0)
  ctx.quadraticCurveTo(0, radius * .04, -radius, 0)
  ctx.fill()
  ctx.strokeStyle = palette.rain
  ctx.globalAlpha *= .42
  ctx.lineWidth = .7
  for (let rib = -2; rib <= 2; rib++) {
    ctx.beginPath()
    ctx.moveTo(radius * rib / 3, radius * .01)
    ctx.quadraticCurveTo(radius * rib / 5, radius * .28, 0, radius * .43)
    ctx.stroke()
  }
  ctx.restore()
}

function umbrellaField(ctx: Context, width: number, height: number, time: number, palette: RainPalette) {
  // An independent wash of slanting rain bands replaces the illustrated setting.
  const wash = ctx.createLinearGradient(0, 0, width * .35, height)
  wash.addColorStop(0, palette.rain)
  wash.addColorStop(1, palette.paper)
  ctx.fillStyle = wash
  ctx.fillRect(0, 0, width, height)
  for (let band = 0; band < 15; band++) {
    const x = width * (band / 13 - .1)
    const bend = Math.sin(band * 2.3) * width * .09
    ctx.globalAlpha = .12 + seed(band) * .1
    ctx.fillStyle = band % 3 ? palette.sheet : palette.deep
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.bezierCurveTo(x + bend, height * .4, x - bend, height * .55, x + width * .05, height)
    ctx.lineTo(x + width * .09, height)
    ctx.bezierCurveTo(x + width * .08 - bend, height * .55, x + bend + width * .04, height * .4, x + width * .05, 0)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  const radius = Math.min(width * .067, height * .069)
  const pitch = radius * 2.14
  const rows = Math.ceil(height / pitch) + 4
  const columns = Math.ceil(width / pitch + rows * .25) + 3
  for (let row = -2; row < rows; row++) {
    for (let column = -2; column < columns; column++) {
      const id = (row + 2) * columns + column + 2
      const group = Math.floor(seed(id + 17) * 4)
      const age = time - group * 433
      if (age < 0) continue
      // Each group briefly catches white light, then settles into cyan.
      // The pulse is local to the new canopies, never a full-screen strobe.
      const flash = age < 140 ? .5 + .5 * Math.cos(age / 140 * TAU * 1.5) : 0
      const drift = time / 1000
      const x = column * pitch + row * pitch * -.25 + drift * 5 + width * .05
      const y = row * pitch + column * pitch * -.2 + drift * 3 + height * .09
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(-.07 + seed(id) * .11)
      canopy(ctx, radius, palette.rain, palette.deep)
      if (flash > 0) {
        ctx.globalAlpha = flash
        canopy(ctx, radius, palette.sheet, palette.paper)
      }
      ctx.restore()
    }
  }
  const rise = progress(time, RAIN_TIMING.lift, RAIN_TIMING.flash)
  if (rise > 0) {
    ctx.globalAlpha = smooth(rise)
    invertedUmbrella(ctx, width * .5, lerp(height * 1.15, height * .87, rise), Math.min(width * .26, height * .34), palette)
    ctx.globalAlpha = 1
  }
}

function paperSquare(ctx: Context, x: number, y: number, size: number, rotation: number, pitch: number, color: string, edge: string) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  const half = size / 2
  const foreshorten = Math.cos(pitch)
  const depth = Math.sin(pitch) * .18
  ctx.beginPath()
  for (let corner = 0; corner < 4; corner++) {
    const u = corner === 0 || corner === 3 ? -1 : 1
    const v = corner < 2 ? -1 : 1
    const perspective = 1 / (1 + v * depth)
    const px = u * half * perspective
    const py = v * half * foreshorten * perspective
    if (corner === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = .65
  ctx.strokeStyle = edge
  ctx.stroke()
  ctx.restore()
}

function waterStrokes(ctx: Context, width: number, height: number, seconds: number, palette: RainPalette) {
  const count = width < 500 ? 24 : 42
  ctx.fillStyle = palette.rain
  for (let stroke = 0; stroke < count; stroke++) {
    const side = stroke % 2 ? Math.PI : 0
    const start = side - 1.32 + seed(stroke + 51) * 1.5
    const span = .24 + seed(stroke + 82) * .92
    const radius = .64 + seed(stroke + 130) * .4
    const rx = width * .46 * radius
    const ry = height * .81 * radius
    const thickness = .6 + seed(stroke + 240) * 4
    ctx.globalAlpha = .25 + seed(stroke + 380) * .5
    ctx.beginPath()
    // Tapered, broken ribbons, made from analytic curves instead of traced ink.
    for (let edge = 0; edge < 2; edge++) {
      for (let point = 0; point <= 22; point++) {
        const u = edge ? 1 - point / 22 : point / 22
        const angle = start + span * u + seconds * .025
        const rough = Math.sin(angle * 19 + stroke * 3) * 1.4 + Math.sin(angle * 73 + stroke) * 1.2
        const bristle = .7 + Math.sin(angle * 57 + stroke) * .3
        const taper = Math.sin(u * Math.PI) * thickness * bristle * (edge ? -1 : 1)
        const x = width * .5 + Math.cos(angle) * (rx + rough + taper)
        const y = height * .43 + Math.sin(angle) * (ry + rough + taper)
        if (edge === 0 && point === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
    }
    ctx.closePath()
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function paperChamber(ctx: Context, width: number, height: number, time: number, palette: RainPalette) {
  const seconds = (time - RAIN_TIMING.chamber) / 1000
  const unit = Math.min(width, height)
  waterStrokes(ctx, width, height, seconds, palette)
  const rim = Math.max(12, unit * .056)
  ctx.strokeStyle = palette.line
  ctx.lineWidth = .7
  ctx.strokeRect(rim, rim, width - rim * 2, height - rim * 2)

  ctx.fillStyle = palette.deep
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `300 ${Math.min(width * .102, height * .16)}px ${palette.font}`
  ctx.fillText('把片刻，留给雨声。', width * .5, height * .2, width * .94)

  const cloudCount = width < 500 ? 25 : 46
  for (let index = 0; index < cloudCount; index++) {
    const x = width * seed(index + 520) + Math.sin(seconds * .6 + index) * unit * .008
    const y = height * (-.015 + seed(index + 610) * .18)
    const size = unit * (.03 + seed(index + 740) * .086)
    paperSquare(ctx, x, y, size, seed(index + 820) * 1.4 - .7 + seconds * .018,
      Math.sin(index + seconds * .3) * .45, index % 4 ? palette.sheet : palette.rain, palette.line)
  }

  const landing = height * .64
  const funnelCount = width < 500 ? 36 : 64
  for (let index = 0; index < funnelCount; index++) {
    const fall = (seed(index + 910) + seconds * (.12 + seed(index + 930) * .06)) % 1
    const spread = .22 + .78 * Math.pow(1 - fall, 1.65)
    const x = width * .5 + (seed(index + 980) - .5) * width * .66 * spread
      + Math.sin(index * 1.4 + seconds * .8) * unit * .012
    const y = lerp(height * .12, landing, fall)
    const size = unit * (.014 + seed(index + 1030) * .067) * lerp(1, .65, fall)
    paperSquare(ctx, x, y, size, index * 2.4 + seconds * (seed(index + 1160) - .5),
      Math.sin(index + seconds) * .85, index % 6 ? palette.sheet : palette.rain, palette.line)
  }

  const radius = Math.min(width * .16, height * .165)
  invertedUmbrella(ctx, width * .5, landing + Math.sin(seconds * 2) * unit * .007, radius, palette, Math.sin(seconds) * .012)
  ctx.fillStyle = palette.deep
  ctx.font = `400 ${Math.max(8, Math.min(11, unit * .014))}px ${palette.font}`
  ctx.globalAlpha = .66
  ctx.fillText('Y O R O R O I C E   /   A R K', width * .5, landing + radius * .82)
  for (let drop = 0; drop < 7; drop++) {
    const fill = smooth(progress(seconds, .12 + drop * .13, .32 + drop * .13))
    ctx.beginPath()
    ctx.arc(width * .5 + (drop - 3) * 9, landing + radius * 1.06, 1 + fill * 1.1, 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function curtain(ctx: Context, width: number, height: number, cover: number, reveal: number, palette: RainPalette) {
  // Overscan is based on the viewport diagonal: even a rotated sheet fully
  // covers all four corners at the route handoff, including portrait screens.
  const diagonal = Math.hypot(width, height)
  const paperWidth = diagonal * 1.24
  const paperHeight = diagonal * 1.24
  const acceleration = cover * .13 + Math.pow(cover, 5) * .87
  const fall = smooth(reveal)
  const centerY = lerp(-paperHeight * .56, height * .5, acceleration)
    + fall * (height * .5 + diagonal * 1.05)
  ctx.save()
  ctx.translate(width * .5 + fall * width * .08, centerY)
  ctx.rotate(-.09 - fall * .24)
  ctx.fillStyle = palette.sheet
  ctx.shadowColor = palette.line
  ctx.shadowBlur = Math.min(width, height) * .009
  ctx.shadowOffsetY = 3
  ctx.fillRect(-paperWidth / 2, -paperHeight / 2, paperWidth, paperHeight)
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  // A narrow folded edge gives the otherwise blank sheet a physical boundary.
  ctx.globalAlpha = .11
  ctx.fillStyle = palette.deep
  ctx.fillRect(-paperWidth / 2, paperHeight / 2 - 4, paperWidth, 3)
  ctx.restore()
}

export function drawRainConnection(
  ctx: Context,
  width: number,
  height: number,
  time: number,
  reveal: number,
  palette: RainPalette,
) {
  ctx.clearRect(0, 0, width, height)
  const dropping = reveal > 0
  if (!dropping) {
    ctx.fillStyle = palette.paper
    ctx.fillRect(0, 0, width, height)
    if (time < RAIN_TIMING.flash) {
      const rim = Math.max(12, Math.min(width, height) * .056)
      ctx.save()
      ctx.beginPath()
      ctx.rect(rim, rim, width - rim * 2, height - rim * 2)
      ctx.clip()
      ctx.translate(rim, rim)
      umbrellaField(ctx, width - rim * 2, height - rim * 2, time, palette)
      ctx.restore()
    }
    else if (time >= RAIN_TIMING.chamber) paperChamber(ctx, width, height, time, palette)
    else {
      ctx.fillStyle = palette.sheet
      ctx.fillRect(0, 0, width, height)
    }
  }
  if (time >= RAIN_TIMING.paper || dropping) {
    curtain(ctx, width, height, progress(time, RAIN_TIMING.paper, RAIN_TIMING.covered), reveal, palette)
  }
}
