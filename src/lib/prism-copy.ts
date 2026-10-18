import type { Locale } from './blog'

// Album-inspired visual language, with original copy for this personal site.
export const PRISM_COPY = {
  zh: { name: '月之暗面', description: '棱镜 · 光谱 · 唱片内页', headline: '让日常，折射出另一面。', note: '文字、片刻与未曾散去的回声。', enter: '进入光谱', menu: '选择另一面', side: '个人博客', collection: '每一段记录，都有自己的频率。' },
  en: { name: 'Dark Side', description: 'Prism · Spectrum · Liner notes', headline: 'Another side of the everyday.', note: 'Words, moments, and echoes that remain.', enter: 'Enter the spectrum', menu: 'Choose a side', side: 'Personal blog', collection: 'Every record has a frequency of its own.' },
  ja: { name: '月の裏側', description: 'プリズム・光・ライナーノーツ', headline: '日常に、もうひとつの光を。', note: '言葉、瞬間、そして残る響き。', enter: '光の中へ', menu: '次の一面へ', side: '個人ブログ', collection: 'すべての記録に、それぞれの響きがある。' },
  de: { name: 'Dark Side', description: 'Prisma · Spektrum · Begleitheft', headline: 'Eine andere Seite des Alltags.', note: 'Worte, Momente und bleibende Echos.', enter: 'Ins Spektrum', menu: 'Eine Seite wählen', side: 'Persönlicher Blog', collection: 'Jede Erinnerung hat ihre eigene Frequenz.' },
} satisfies Record<Locale, { name: string; description: string; headline: string; note: string; enter: string; menu: string; side: string; collection: string }>

export const SPECTRUM = ['#e66054', '#e9994d', '#e8cd65', '#77b787', '#669ed1', '#aa88bc'] as const
