import type { Locale } from './blog'

export const VOYAGE_COPY: Record<Locale, { name: string; description: string }> = {
  zh: { name: '夜航', description: '深蓝航路 · 荧黄坐标 · 在内容之间航行' },
  en: { name: 'Night Voyage', description: 'Cobalt routes · Phosphor signals · A reading atlas' },
  ja: { name: '夜航', description: '深青の航路・蛍光の標・読むための海図' },
  de: { name: 'Nachtfahrt', description: 'Kobaltblaue Routen · Leuchtsignale · Ein Leseatlas' },
}
