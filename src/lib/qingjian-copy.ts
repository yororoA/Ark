import type { Locale } from './blog'

// Display copy is independent of the persisted `rain` design identifier.
export const QINGJIAN_COPY = {
  zh: {
    name: '青笺',
    description: '青色 · 纸页 · 留白',
    headline: '在时间的留白里，写下日常。',
    caption: '把片刻，写进青笺。',
  },
  en: {
    name: 'Qingjian',
    description: 'Cyan · Paper · Space',
    headline: 'Everyday life, written in the margins of time.',
    caption: 'Moments, written in Qingjian.',
  },
  ja: {
    name: '青笺',
    description: '青色・紙・余白',
    headline: '時の余白に、日々を綴る。',
    caption: 'ひとときを、青笺に綴る。',
  },
  de: {
    name: 'Qingjian',
    description: 'Cyan · Papier · Freiraum',
    headline: 'Alltag, festgehalten am Rand der Zeit.',
    caption: 'Momente, in Qingjian festgehalten.',
  },
} satisfies Record<Locale, {
  name: string
  description: string
  headline: string
  caption: string
}>
