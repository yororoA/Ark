import type { Locale } from '@/lib/blog'

export const VOYAGE_CONNECTION_COPY = {
  zh: {
    dialog: '夜航 · 身份确认', continuation: '从此处，继续。', introduction: '一条新的航路。',
    stations: ['身份', '接通', '抵达'], pending: '正在确认身份', confirmed: '航路已接通', held: '暂时停靠',
    departure: '出发', reading: '继续阅读', pendingStatus: '正在确认身份…', confirmedStatus: '身份已确认，信号已接通。',
    openingStatus: '身份已确认，正在打开页面…', readyStatus: '航行，继续。', errorStatus: '连接未完成',
    skip: '跳过动画 ↗', back: '返回登录 ↗', fallbackError: '暂时无法连接，请稍后重试。',
    slow: '页面加载较慢，可以直接打开目标页，或返回重试。', open: '打开目标页 ↗',
  },
  en: {
    dialog: 'Night Voyage · Identity check', continuation: 'Continue from here.', introduction: 'A new passage begins.',
    stations: ['Identity', 'Connected', 'Arrival'], pending: 'Checking your identity', confirmed: 'Your passage is confirmed', held: 'A brief stop',
    departure: 'Departure', reading: 'Continue reading', pendingStatus: 'Checking your identity…', confirmedStatus: 'Identity confirmed. Setting course.',
    openingStatus: 'Identity confirmed. Opening the page…', readyStatus: 'The next chapter is ready.', errorStatus: 'Connection incomplete',
    skip: 'Skip animation ↗', back: 'Back to login ↗', fallbackError: 'Unable to connect right now. Please try again.',
    slow: 'The page is taking longer to load. Open it directly, or go back and try again.', open: 'Open the page ↗',
  },
  ja: {
    dialog: '夜航 · 本人確認', continuation: 'ここから、続きを。', introduction: '新しい航路へ。',
    stations: ['本人確認', '接続', '到着'], pending: '本人確認中', confirmed: '航路がつながりました', held: 'しばらく停泊',
    departure: '出発', reading: '続きを読む', pendingStatus: '本人確認中…', confirmedStatus: '本人確認が完了しました。航路を設定しています。',
    openingStatus: '本人確認が完了しました。ページを開いています…', readyStatus: '次の章へ進みます。', errorStatus: '接続が完了していません',
    skip: 'アニメーションをスキップ ↗', back: 'ログインに戻る ↗', fallbackError: '接続できませんでした。もう一度お試しください。',
    slow: '読み込みに時間がかかっています。ページを直接開くか、戻ってお試しください。', open: 'ページを開く ↗',
  },
  de: {
    dialog: 'Nachtfahrt · Identitätsprüfung', continuation: 'Von hier aus weiter.', introduction: 'Eine neue Route beginnt.',
    stations: ['Identität', 'Verbunden', 'Ankunft'], pending: 'Identität wird geprüft', confirmed: 'Deine Route ist bestätigt', held: 'Ein kurzer Halt',
    departure: 'Abfahrt', reading: 'Weiterlesen', pendingStatus: 'Identität wird geprüft…', confirmedStatus: 'Identität bestätigt. Die Route wird vorbereitet.',
    openingStatus: 'Identität bestätigt. Die Seite wird geöffnet…', readyStatus: 'Das nächste Kapitel ist bereit.', errorStatus: 'Verbindung nicht abgeschlossen',
    skip: 'Animation überspringen ↗', back: 'Zurück zur Anmeldung ↗', fallbackError: 'Verbindung derzeit nicht möglich. Bitte versuche es erneut.',
    slow: 'Die Seite lädt länger als erwartet. Öffne sie direkt oder gehe zurück und versuche es erneut.', open: 'Seite öffnen ↗',
  },
} satisfies Record<Locale, { dialog: string; continuation: string; introduction: string; stations: string[]; pending: string; confirmed: string; held: string; departure: string; reading: string; pendingStatus: string; confirmedStatus: string; openingStatus: string; readyStatus: string; errorStatus: string; skip: string; back: string; fallbackError: string; slow: string; open: string }>

// This overlay is outside BlogProvider. Capture the same persisted preference
// without mounting another provider or changing the authentication boundary.
export function connectionLocale(): Locale {
  try {
    const saved = localStorage.getItem('ark.locale')
    if (saved === 'zh' || saved === 'en' || saved === 'ja' || saved === 'de') return saved
  } catch { /* Storage may be unavailable in private browsing. */ }
  const language = navigator.language.split('-')[0]
  return language === 'zh' || language === 'ja' || language === 'de' ? language : 'en'
}
