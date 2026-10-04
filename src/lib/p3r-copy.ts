import type { Locale } from './blog'

export const P3R_COPY = {
  zh: { name: 'P3R', description: '深蓝 · 切片 · 流动', headline: '把每一天，写成自己的故事。', menu: '选择下一站', today: '今天', enter: '进入档案', note: '文字、日常，以及相遇。', access: '继续你的故事' },
  en: { name: 'P3R', description: 'Blue · Angles · Motion', headline: 'Every day, a story of your own.', menu: 'Where to next?', today: 'Today', enter: 'Enter the archive', note: 'Words, days, and encounters.', access: 'Continue your story' },
  ja: { name: 'P3R', description: '群青・斜線・流れ', headline: '毎日を、自分だけの物語に。', menu: '次の場所を選ぶ', today: '今日', enter: '記録をひらく', note: '言葉と日々、そして出会い。', access: '物語の続きを' },
  de: { name: 'P3R', description: 'Blau · Kanten · Bewegung', headline: 'Jeden Tag deine Geschichte schreiben.', menu: 'Wohin als Nächstes?', today: 'Heute', enter: 'Archiv öffnen', note: 'Worte, Alltag und Begegnungen.', access: 'Deine Geschichte geht weiter' },
} satisfies Record<Locale, { name: string; description: string; headline: string; menu: string; today: string; enter: string; note: string; access: string }>
