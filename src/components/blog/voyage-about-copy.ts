import type { Locale } from '@/lib/blog'

export const voyageAboutCopy = {
  zh: {
    person: '写在这里的人', tools: '日常所用', interests: '日常所爱', email: '给我写信',
    incoming: '留下的回声', publicNote: '留言将显示在这一页。',
    emptyTitle: '这一页，尚待落笔。', emptyNote: '还没有来访留言。留下的话，会在这里被看见。',
    noLinks: '还没有这一类地址。', noLinksNote: '试试其他分类，看看相连的世界。',
    channels: '站外联系', filters: '链接分类',
  },
  en: {
    person: 'The person behind the words', tools: 'Tools I use', interests: 'Things I enjoy', email: 'Write to me',
    incoming: 'Words left here', publicNote: 'Your message will appear on this page.',
    emptyTitle: 'A page still unwritten.', emptyNote: 'No messages yet. The words you leave will find a place here.',
    noLinks: 'No addresses in this category yet.', noLinksNote: 'Try another category to explore the connections.',
    channels: 'Find me elsewhere', filters: 'Link categories',
  },
  ja: {
    person: 'ここに言葉を綴る人', tools: '日々使うもの', interests: '日々好きなもの', email: '手紙を書く',
    incoming: '残された言葉', publicNote: 'メッセージはこのページに表示されます。',
    emptyTitle: 'まだ、白紙のページ。', emptyNote: 'メッセージはまだありません。残された言葉は、ここに届きます。',
    noLinks: 'この分類には、まだアドレスがありません。', noLinksNote: 'ほかの分類から、つながる世界を探してみてください。',
    channels: 'ほかの場所で', filters: 'リンクの分類',
  },
  de: {
    person: 'Der Mensch hinter den Worten', tools: 'Meine Werkzeuge', interests: 'Was mich begeistert', email: 'Schreib mir',
    incoming: 'Hinterlassene Worte', publicNote: 'Deine Nachricht erscheint auf dieser Seite.',
    emptyTitle: 'Eine noch unbeschriebene Seite.', emptyNote: 'Noch gibt es keine Nachrichten. Deine Worte finden hier ihren Platz.',
    noLinks: 'Noch keine Adressen in dieser Kategorie.', noLinksNote: 'Entdecke die Verbindungen in einer anderen Kategorie.',
    channels: 'Anderswo erreichbar', filters: 'Link-Kategorien',
  },
} satisfies Record<Locale, Record<string, string>>
