import type { Locale } from './blog'

// These are visual seeds supplied for this theme, never account credentials.
export const ALLOTYPES = [
  { name: 'MD5', value: '9191193ef38ae4494524c995be73864a', color: '#919119' },
  { name: 'SHA-1', value: 'c6dc4c08f10920462617037475ff7bf212ebaadb', color: '#c6dc4c' },
  { name: 'SHA-256', value: 'e7d47b58ab52d84566d4485155e3cf344acb0182a5e4dfc099bb4d20fb97c435', color: '#e7d47b' },
  { name: 'SHA3-256', value: '623b49e2ea29a70f027225a21eb8d055b6784a135755483e848b5e4838eef54a', color: '#623b49' },
  { name: 'BLAKE2b', value: 'ff13460558b656868adfadf1d27250a294a3a8971c815e57fdf7b05fd1c46382eeef4cd37306093d4e3290db9bf37997ded8674ec6d52b517c78f1114d96f1c9', color: '#ff1346' },
] as const

export const ALLOTYPE_COPY: Record<Locale, {
  name: string; description: string; first: string; second: string; note: string
  explore: string; switch: string; selected: string; writing: string; moments: string; colophon: string
}> = {
  zh: { name: '异相', description: '五种指纹 · 生成海报 · 异色套印', first: '保持', second: '异相', note: '一些文字，一些瞬间。留下的痕迹，慢慢长成自己的形状。', explore: '进入文字', switch: '切换形态', selected: '此刻的切面', writing: '文字的形状', moments: '瞬间的余温', colophon: '同一存在，五种异相。' },
  en: { name: 'Allotype', description: 'Fingerprints · Acid print · Living forms', first: 'STAY', second: 'UNLIKE.', note: 'Words, moments, and the traces they leave. A shape that slowly becomes your own.', explore: 'Read the stories', switch: 'Change form', selected: 'CURRENT IMPRESSION', writing: 'Words take shape', moments: 'Afterimages', colophon: 'One presence. Five impressions.' },
  ja: { name: '異相', description: '指紋・アシッド印刷・流れる形', first: 'いつも', second: '異なる', note: '言葉と瞬間。残した痕跡が、少しずつ自分だけの形になる。', explore: '言葉を読む', switch: '形を切り替える', selected: 'いまの断面', writing: '言葉のかたち', moments: '瞬間の余韻', colophon: 'ひとつの存在、五つの異相。' },
  de: { name: 'Allotyp', description: 'Fingerabdruck · Säuredruck · Lebendige Form', first: 'BLEIB', second: 'ANDERS.', note: 'Worte, Momente und ihre Spuren. Eine Form, die langsam deine eigene wird.', explore: 'Geschichten lesen', switch: 'Form wechseln', selected: 'AKTUELLER ABDRUCK', writing: 'Worte nehmen Form an', moments: 'Nachbilder', colophon: 'Eine Präsenz. Fünf Ansichten.' },
}

// Every byte contributes to a smooth harmonic. Identical seeds always yield
// identical contours on server and client; there is no random render state.
export function fingerprintPaths(value: string) {
  const bytes = value.match(/../g)!.map(byte => Number.parseInt(byte, 16) / 255)
  const harmonics = Array.from({ length: 6 }, (_, band) => {
    const group = bytes.filter((_, index) => index % 6 === band)
    return group.reduce((sum, byte, index) => sum + byte * (index + 1) * 1.618, 0) % 1
  })
  const lobes = 2 + Number.parseInt(value[0], 16) % 4
  return Array.from({ length: 34 }, (_, ring) => {
    const radius = 38 + ring * 6.5
    const points = Array.from({ length: 97 }, (_, index) => {
      const angle = index / 96 * Math.PI * 2
      const ripple = harmonics.reduce((sum, value, band) =>
        sum + Math.sin(angle * (band + 2) + value * Math.PI * 2 + ring * .017) * (.105 / (band + 1)), 0)
      const r = radius * (1 + ripple + Math.sin(angle * lobes + harmonics[1] * 6) * .12)
      const x = 340 + Math.cos(angle) * r * 1.06 + Math.sin(ring * .07) * 22
      const y = 340 + Math.sin(angle) * r * .94 + Math.cos(angle * 2 + harmonics[0] * 6) * 28
      return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    return points.join('') + 'Z'
  })
}


export type AllotypeMark = {
  d: string
  ink?: 'accent' | 'highlight' | 'paper'
  fill?: boolean
  width?: number
  opacity?: number
}

const TAU = Math.PI * 2
const point = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`
const polar = (radius: number, angle: number) => point(340 + Math.cos(angle) * radius, 340 + Math.sin(angle) * radius)

// Fold every byte into a stable local generator. No Math.random, browser-only
// state or SVG filters: all five plates print identically on server and client.
function plateRandom(value: string) {
  let state = 2166136261
  for (let index = 0; index < value.length; index += 2) {
    state = Math.imul(state ^ Number.parseInt(value.slice(index, index + 2), 16), 16777619) >>> 0
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let next = Math.imul(state ^ state >>> 15, 1 | state)
    next ^= next + Math.imul(next ^ next >>> 7, 61 | next)
    return ((next ^ next >>> 14) >>> 0) / 4294967296
  }
}

// Each algorithm is its own drawing grammar, not a recoloured version of the
// same contour. Keeping a bounded number of marks makes switching inexpensive.
export function allotypeMarks(value: string, form: number): AllotypeMark[] {
  const random = plateRandom(value)
  const phase = random() * TAU
  const marks: AllotypeMark[] = []
  const curve = (samples: number, at: (t: number) => string, close = false) =>
    Array.from({ length: samples + 1 }, (_, step) => `${step ? 'L' : 'M'}${at(step / samples)}`).join('') + (close ? 'Z' : '')

  if (form === 0) {
    // A woven torus: offset copper plates and longitudinal wires make moiré.
    const turn = -.34 + random() * .1
    const project = (u: number, v: number) => {
      const tube = 73 + Math.sin(u * 3 + phase) * 8
      const radius = 177 + tube * Math.cos(v)
      const x = radius * Math.cos(u)
      const y = radius * Math.sin(u) * .72 + tube * Math.sin(v) * .88
      return point(340 + x * Math.cos(turn) - y * Math.sin(turn), 340 + x * Math.sin(turn) + y * Math.cos(turn))
    }
    for (let line = 0; line < 40; line++) {
      marks.push({ d: curve(112, t => project(t * TAU, line / 40 * TAU), true), width: line % 10 === 0 ? 2.4 : 1.3, ink: line % 10 === 0 ? 'accent' : undefined, opacity: .9 })
    }
    for (let line = 0; line < 52; line++) {
      marks.push({ d: curve(32, t => project(line / 52 * TAU, t * TAU), true), width: 1.1, opacity: .65 })
    }
    marks.push({ d: `M${point(83, 502)}L${point(183, 502)}M${point(133, 452)}L${point(133, 552)}`, ink: 'highlight', width: 2.4 })
  } else if (form === 1) {
    // Elliptical trajectories precess into a dense, astronomical rosette.
    const eccentricity = 49 + random() * 22
    for (let orbit = 0; orbit < 43; orbit++) {
      const rotation = orbit / 43 * Math.PI + phase
      const skew = random() * 8
      marks.push({ d: curve(96, t => {
        const a = t * TAU
        const x = Math.cos(a) * (253 + Math.sin(a * 3 + phase) * 8)
        const y = Math.sin(a) * (eccentricity + skew)
        return point(340 + x * Math.cos(rotation) - y * Math.sin(rotation), 340 + x * Math.sin(rotation) + y * Math.cos(rotation))
      }, true), width: orbit % 7 === 0 ? 2.1 : 1.2, ink: orbit % 7 === 0 ? 'highlight' : undefined, opacity: .9 })
    }
    marks.push({ d: `M${polar(33, 0)}A33 33 0 1 0 ${polar(33, Math.PI)}A33 33 0 1 0 ${polar(33, 0)}Z`, fill: true, ink: 'accent' })
    marks.push({ d: 'M329 340H351M340 329V351', width: 2.5, ink: 'paper' })
  } else if (form === 2) {
    // A square sampling lattice is displaced into a folded halftone terrain.
    const crest = random() * 1.5
    for (let row = 0; row < 31; row++) {
      let d = ''
      for (let column = 0; column < 33; column++) {
        const u = column / 32 * 2 - 1
        const v = row / 30 * 2 - 1
        const wave = Math.sin(u * 3 + v * 2 + phase) * Math.cos(v * 2.3 + crest)
        const x = 340 + u * 217 + v * 36
        const y = 340 + v * 166 + wave * 90 - u * 28
        const radius = 1.35 + (wave + 1) * 1.55 + random() * .55
        d += `M${point(x + radius, y)}a${radius.toFixed(2)},${radius.toFixed(2)} 0 1 0 ${(-2 * radius).toFixed(2)},0a${radius.toFixed(2)},${radius.toFixed(2)} 0 1 0 ${(2 * radius).toFixed(2)},0Z`
      }
      marks.push({ d, fill: true, ink: row > 13 && row < 18 ? 'accent' : row < 3 ? 'highlight' : undefined })
    }
    marks.push({ d: 'M80 117V80H117M563 600H600V563', width: 1.5, ink: 'accent' })
  } else if (form === 3) {
    // Parallel fibres fold through three turns, producing an impossible ribbon.
    const twist = random() * .5 - .25
    const project = (t: number, strand: number) => {
      const turn = t * Math.PI * 3 + twist
      const x = 340 + Math.sin(t * TAU + phase * .15) * 103 + strand * Math.cos(turn) * 137
      const y = 96 + t * 488 + strand * Math.sin(turn) * 39
      return point(x, y)
    }
    for (let strand = 0; strand < 63; strand++) {
      marks.push({ d: curve(100, t => project(t, strand / 62 * 2 - 1)), width: strand % 11 === 0 ? 2 : 1.35, ink: strand > 42 ? 'accent' : strand < 7 ? 'highlight' : undefined })
    }
    for (const end of [0, 1]) marks.push({ d: curve(32, t => project(end, t * 2 - 1)), width: 2 })
  } else {
    // Byte-length corona: sharp apertures surrounding a completely silent core.
    const rays = 160
    for (let ray = 0; ray < rays; ray++) {
      const angle = ray / rays * TAU + phase
      const inner = 92 + random() * 22
      const outer = 205 + random() * 67
      const spread = .008 + random() * .006
      marks.push({ d: `M${polar(inner, angle - spread)}L${polar(outer, angle)}L${polar(inner, angle + spread)}Z`, fill: true, ink: ray % 5 === 0 ? 'accent' : ray % 17 === 0 ? 'highlight' : undefined })
    }
    for (let tick = 0; tick < 64; tick++) {
      const angle = tick / 64 * TAU + phase
      const length = 4 + Number.parseInt(value[tick % value.length], 16) / 2
      marks.push({ d: `M${polar(76, angle)}L${polar(76 + length, angle)}`, width: 1.5, ink: 'accent' })
    }
    marks.push({ d: 'M320 340H360M340 320V360', width: 1.3 })
  }
  return marks
}
