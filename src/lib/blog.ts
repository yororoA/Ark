export type Locale = 'zh' | 'en' | 'ja' | 'de'
export type Session = { uid: string; username: string; isGuest: boolean; isAdmin: boolean }
export type Entry = {
  _id: string; title: string; content: string; uid: string; username?: string
  createdAt: string; updatedAt?: string; category?: string; tags?: string[]
  likes?: number; views?: number; comments?: string[]; published?: boolean
  filenames?: Record<string, string>
  filesDetail?: Record<string, { origin?: string; desc?: string; secure_url?: string }>
}
export type Comment = { _id: string; content: string; username: string; uid: string; createdAt: string; likes?: number; belong?: string }
export type Media = { filename: string; url: string; mime: string; username?: string; createdAt?: string; desc?: string }
export type BlogLink = { _id: string; name: string; url: string; description?: string; category: string; imgurl?: string }
export type Envelope<T> = { data: T; pagination?: { page: number; pages: number; total: number; limit: number }; hasMore?: boolean }
export type HomeMomentSummary = { entries: Entry[]; activeDates: string[] }
export type ArchiveEntry = Pick<Entry, '_id' | 'title' | 'uid' | 'username' | 'createdAt' | 'updatedAt'> & {
  kind: 'articles' | 'moments'
}
export type SitemapContent = {
  articles: Array<Pick<Entry, '_id' | 'createdAt' | 'updatedAt'> & { coverUrl?: string }>
  moments: Array<Pick<Entry, '_id' | 'createdAt' | 'updatedAt'> & { images: string[] }>
}
export const PROFILE = {
  author: 'yororoIce', description: 'Time mends the wounds, love soothes the scars.',
  email: '3364817735song@gmail.com', github: 'https://github.com/yororoA',
  bilibili: 'https://space.bilibili.com/411513480', x: 'https://x.com/yororo_ice',
  skills: ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Golang', 'Rust', 'MongoDB'],
  interests: ['Coding', 'Photography', 'Travel', 'Reading', 'Music', 'Gaming', 'Anime'],
}
export const sections = [
  ['home', '00', 'Prologue'], ['articles', '01', 'Writings'], ['moments', '02', 'Fragments'],
  ['gallery', '03', 'Gallery'], ['archive', '04', 'Archive'], ['about', '05', 'About'], ['lab', '06', 'Laboratory'],
] as const

const words = {
  home: ['序章', 'Prologue', '序章', 'Prolog'],
  articles: ['文章', 'Writings', '文章', 'Texte'],
  moments: ['片刻', 'Fragments', '日々', 'Momente'],
  gallery: ['映像', 'Gallery', 'ギャラリー', 'Galerie'],
  archive: ['归档', 'Archive', 'アーカイブ', 'Archiv'],
  about: ['关于', 'About', 'この場所について', 'Über mich'],
  lab: ['实验室', 'Laboratory', '実験室', 'Labor'],
  chat: ['通信', 'Chat', 'チャット', 'Chat'],
  login: ['登录 / 接入', 'Sign in', 'ログイン', 'Anmelden'],
  logout: ['退出登录', 'Sign out', 'ログアウト', 'Abmelden'],
  account: ['切换账号', 'Switch account', 'アカウント切替', 'Konto wechseln'],
  menu: ['打开导航', 'Open menu', 'メニュー', 'Menü öffnen'],
  close: ['关闭', 'Close', '閉じる', 'Schließen'],
  light: ['浅色', 'Light', 'ライト', 'Hell'],
  dark: ['深色', 'Dark', 'ダーク', 'Dunkel'],
  system: ['跟随系统', 'System', 'システム', 'System'],
  theme: ['主题', 'Theme', 'テーマ', 'Design'],
  language: ['语言', 'Language', '言語', 'Sprache'],
  latest: ['最近的记录', 'Recent entries', '最近の記録', 'Neue Einträge'],
  all: ['全部', 'All', 'すべて', 'Alle'],
  read: ['开始阅读', 'Start reading', '読み始める', 'Lesen'],
  explore: ['翻阅片刻', 'Explore fragments', '日々をめくる', 'Momente ansehen'],
  intro: ['在时间的罅隙里，留下回声。', 'An echo, in the folds of time.', '時の隙間に、響きを残す。', 'Ein Echo in den Falten der Zeit.'],
  introBody: ['这里收藏代码、日常与偶然闪过的念头。', 'A collection of code, everyday life, and passing thoughts.', 'コードと日常、ふと浮かぶ思いを集めて。', 'Code, Alltag und flüchtige Gedanken.'],
  online: ['在线', 'Online', 'オンライン', 'Online'],
  offline: ['离线', 'Offline', 'オフライン', 'Offline'],
  unknown: ['状态未知', 'Status unknown', '状態不明', 'Status unbekannt'],
  loading: ['正在载入…', 'Loading…', '読み込み中…', 'Wird geladen…'],
  retry: ['重试', 'Try again', '再試行', 'Erneut versuchen'],
  empty: ['这里还没有记录。', 'Nothing here yet.', 'まだ記録がありません。', 'Noch keine Einträge.'],
  notFound: ['这一页已经走远了，回到序章继续翻阅吧。', 'This page could not be found. Return to the prologue to continue.', 'このページは見つかりません。序章に戻って続けましょう。', 'Diese Seite wurde nicht gefunden. Kehre zum Prolog zurück.'],
  noResults: ['没有找到符合条件的记录。', 'No matching entries.', '一致する記録がありません。', 'Keine passenden Einträge.'],
  search: ['搜索文章', 'Search writings', '記事を検索', 'Texte suchen'],
  category: ['分类', 'Category', 'カテゴリー', 'Kategorie'],
  previous: ['上一页', 'Previous', '前へ', 'Zurück'],
  next: ['下一页', 'Next', '次へ', 'Weiter'],
  pagination: ['翻页', 'Pagination', 'ページ切替', 'Seitennavigation'],
  more: ['加载更多', 'Load more', 'もっと見る', 'Mehr laden'],
  publish: ['发布', 'Publish', '公開', 'Veröffentlichen'],
  newArticle: ['写文章', 'New writing', '記事を書く', 'Text schreiben'],
  newMoment: ['记录片刻', 'New fragment', '日々を記録', 'Moment festhalten'],
  edit: ['编辑', 'Edit', '編集', 'Bearbeiten'],
  delete: ['删除', 'Delete', '削除', 'Löschen'],
  deleting: ['正在删除…', 'Deleting…', '削除中…', 'Wird gelöscht…'],
  confirmDelete: ['确定删除这条记录？此操作无法撤销。', 'Delete this entry? This cannot be undone.', 'この記録を削除しますか？元に戻せません。', 'Eintrag endgültig löschen?'],
  cancel: ['取消', 'Cancel', 'キャンセル', 'Abbrechen'],
  save: ['保存', 'Save', '保存', 'Speichern'],
  saving: ['正在保存…', 'Saving…', '保存中…', 'Wird gespeichert…'],
  title: ['标题', 'Title', 'タイトル', 'Titel'],
  content: ['内容', 'Content', '内容', 'Inhalt'],
  tags: ['标签（逗号分隔）', 'Tags (comma separated)', 'タグ（カンマ区切り）', 'Tags (kommagetrennt)'],
  preview: ['预览', 'Preview', 'プレビュー', 'Vorschau'],
  zoomOut: ['缩小图片', 'Zoom out', '縮小', 'Verkleinern'],
  resetZoom: ['重置缩放', 'Reset zoom', '表示倍率を戻す', 'Zoom zurücksetzen'],
  zoomIn: ['放大图片', 'Zoom in', '拡大', 'Vergrößern'],
  panZoomImage: ['滚轮缩放，拖拽平移图片', 'Scroll to zoom, drag to pan', 'スクロールで拡大、ドラッグで移動', 'Scrollen zum Zoomen, Ziehen zum Verschieben'],
  upload: ['上传媒体', 'Upload media', 'メディアを追加', 'Medien hochladen'],
  insertMedia: ['插入媒体', 'Insert media', 'メディアを挿入', 'Medien einfügen'],
  dropFiles: ['点击选择或拖入文件', 'Choose or drop files', 'ファイルを選択・ドロップ', 'Dateien wählen oder ablegen'],
  file: ['文件', 'file', 'ファイル', 'Datei'],
  removeFile: ['移除附件', 'Remove attachment', '添付を削除', 'Anhang entfernen'],
  image: ['图片', 'Images', '画像', 'Bilder'],
  video: ['视频', 'Videos', '動画', 'Videos'],
  mediaHint: ['每个文件最多 50 MB。', 'Up to 50 MB per file.', '1ファイル最大50 MB。', 'Bis zu 50 MB pro Datei.'],
  partialUpload: ['内容已保存，但部分附件上传失败，请检查已发布内容。', 'Saved, but some attachments failed. Please check the entry.', '保存しましたが、一部の添付に失敗しました。', 'Gespeichert, aber einige Anhänge fehlen. Bitte prüfen.'],
  chatPartialUpload: ['部分附件上传失败。请重新选择缺失文件，或发送已上传的附件。', 'Some uploads failed. Reselect missing files or send the uploaded attachments.', '一部の添付に失敗しました。再選択するか、アップロード済みの添付を送信してください。', 'Einige Uploads sind fehlgeschlagen. Fehlende Dateien erneut auswählen oder vorhandene senden.'],
  mediaReady: ['个附件已上传，等待发送', 'attachments ready to send', '件の添付が送信待ち', 'Anhänge zum Senden bereit'],
  description: ['描述', 'Description', '説明', 'Beschreibung'],
  mediaDescription: ['媒体描述（可选）', 'Media description (optional)', 'メディアの説明（任意）', 'Medienbeschreibung (optional)'],
  mediaDescriptionHint: ['用于图片替代文本和媒体预览标题，不会显示为片刻正文。', 'Used as image alternative text and the media preview title; it is not part of the fragment text.', '画像の代替テキストとメディアプレビューのタイトルに使用され、本文には表示されません。', 'Wird als Bildalternativtext und Titel der Medienvorschau verwendet; nicht als Momenttext angezeigt.'],
  acknowledge: ['同时将媒体收录到图库', 'Also include media in the gallery', 'ギャラリーにも追加する', 'Medien auch in die Galerie aufnehmen'],
  draft: ['保存草稿', 'Save draft', '下書き保存', 'Entwurf speichern'],
  restoreDraft: ['恢复草稿', 'Restore draft', '下書き復元', 'Entwurf laden'],
  draftMedia: ['草稿的附件需重新选择后上传。', 'Reselect draft attachments before uploading.', '下書きの添付を再選択してください。', 'Entwurfsanhänge bitte erneut auswählen.'],
  saved: ['已保存', 'Saved', '保存しました', 'Gespeichert'],
  like: ['喜欢', 'Like', 'いいね', 'Gefällt mir'],
  liked: ['已喜欢', 'Liked', 'いいね済み', 'Gefällt mir'],
  export: ['导出 Markdown', 'Export Markdown', 'Markdown 出力', 'Markdown exportieren'],
  share: ['复制链接', 'Copy link', 'リンクをコピー', 'Link kopieren'],
  copied: ['链接已复制', 'Link copied', 'コピーしました', 'Link kopiert'],
  comments: ['评论', 'Comments', 'コメント', 'Kommentare'],
  reply: ['回复', 'Reply', '返信', 'Antworten'],
  send: ['发送', 'Send', '送信', 'Senden'],
  sending: ['发送中…', 'Sending…', '送信中…', 'Wird gesendet…'],
  signInToWrite: ['登录后参与评论、发布与点赞。', 'Sign in to comment, publish and like.', 'ログインして投稿やいいねに参加。', 'Zum Kommentieren und Veröffentlichen anmelden.'],
  guestReadOnly: ['游客可留言与聊天；发布和点赞需要注册账号。', 'Guests can use the guestbook and chat. Register to publish and like.', 'ゲストは伝言とチャットを利用できます。', 'Gäste können chatten. Zum Veröffentlichen registrieren.'],
  date: ['日期', 'Date', '日付', 'Datum'],
  allDates: ['不限日期', 'Any date', 'すべての日付', 'Alle Daten'],
  today: ['今天', 'Today', '今日', 'Heute'],
  previousMonth: ['上个月', 'Previous month', '前の月', 'Vorheriger Monat'],
  nextMonth: ['下个月', 'Next month', '次の月', 'Nächster Monat'],
  year: ['年份', 'Year', '年', 'Jahr'],
  reset: ['清除筛选', 'Clear filters', '絞り込み解除', 'Filter zurücksetzen'],
  entries: ['条记录', 'entries', '件', 'Einträge'],
  guestbook: ['来访留言', 'Guestbook', '伝言板', 'Gästebuch'],
  nickname: ['你的名字', 'Your name', 'お名前', 'Dein Name'],
  guestbookHint: ['留下一句话，作为相遇的回声。', 'Leave a few words to remember this encounter.', '出会いのしるしに、ひと言。', 'Hinterlasse ein paar Worte.'],
  links: ['相连的世界', 'Connected worlds', 'つながる世界', 'Verbundene Welten'],
  friend: ['友链', 'Friends', '友達', 'Freunde'],
  tool: ['工具', 'Tools', 'ツール', 'Werkzeuge'],
  development: ['开发', 'Development', '開発', 'Entwicklung'],
  other: ['其他', 'Other', 'その他', 'Sonstiges'],
  newLink: ['添加链接', 'Add link', 'リンク追加', 'Link hinzufügen'],
  url: ['链接地址', 'URL', 'URL', 'URL'],
  group: ['公共频道', 'Public channel', '公開チャンネル', 'Öffentlicher Kanal'],
  admin: ['与作者通信', 'Talk to the author', '作者と話す', 'Mit dem Autor chatten'],
  older: ['更早的消息', 'Earlier messages', '過去のメッセージ', 'Ältere Nachrichten'],
  reconnecting: ['连接中断，正在重连', 'Reconnecting', '再接続中', 'Verbindung wird hergestellt'],
  connected: ['已连接', 'Connected', '接続済み', 'Verbunden'],
  expandChat: ['放大聊天界面', 'Expand chat', 'チャットを拡大', 'Chat vergrößern'],
  collapseChat: ['还原聊天界面', 'Restore chat', 'チャットを戻す', 'Chat verkleinern'],
  back: ['返回', 'Back', '戻る', 'Zurück'],
  toTop: ['回到顶部', 'Back to top', 'トップへ', 'Nach oben'],
  terms: ['社区约定', 'Community guidelines', 'コミュニティ規約', 'Community-Regeln'],
  notice: ['公告', 'Notice', 'お知らせ', 'Hinweis'],
  noticeHistory: ['旧站公告存档（历史版本）', 'Original site announcements (history)', '旧サイトのお知らせ（履歴）', 'Ankündigungen der früheren Website (Archiv)'],
  calendar: ['记录日历', 'Entry calendar', '記録カレンダー', 'Eintragskalender'],
  activity: ['代码与探索', 'Code & exploration', 'コードと探求', 'Code & Entdeckungen'],
  repositories: ['个仓库', 'repositories', 'リポジトリ', 'Repositories'],
  commits: ['本月提交', 'commits this month', '今月のコミット', 'Commits diesen Monat'],
  labTitle: ['让时间，以另一种速度流动。', 'Let time move at another pace.', '時間を、別の速度で。', 'Zeit in einem anderen Tempo.'],
  labBody: ['用数学公式、预设或手绘曲线控制音视频播放速率。', 'Control playback speed with formulas, presets or hand-drawn curves.', '数式や手描き曲線で再生速度を制御。', 'Wiedergabetempo mit Formeln oder Kurven steuern.'],
  openTool: ['打开变速播放器', 'Open speed player', 'プレイヤーを開く', 'Player öffnen'],
  readTime: ['分钟阅读', 'min read', '分で読めます', 'Min. Lesezeit'],
} satisfies Record<string, [string, string, string, string]>

export type TextKey = keyof typeof words
export function translate(locale: Locale, key: TextKey) { return words[key][(['zh', 'en', 'ja', 'de'] as const).indexOf(locale)] }
export function dateLabel(value: string, locale: Locale = 'zh') {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString({ zh: 'zh-CN', en: 'en-GB', ja: 'ja-JP', de: 'de-DE' }[locale], { year: 'numeric', month: 'short', day: '2-digit' })
}
export function excerpt(value: string, length = 140) { return value.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/[#*_>`~[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, length) }
export function safeUrl(value?: string) { return value && /^(https?:\/\/|mailto:)/i.test(value) ? value : undefined }
export function articlePreview(markdown: string) {
  if (!markdown) return { coverUrl: undefined, coverAlt: '', content: '' }
  const lines = markdown.trim().split(/\r?\n/)
  const firstContentLine = lines.findIndex(line => line.trim())
  if (firstContentLine < 0) return { coverUrl: undefined, coverAlt: '', content: markdown }
  const match = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(lines[firstContentLine].trim())
  const coverUrl = safeUrl(match?.[2]?.trim())
  if (!match || !coverUrl) return { coverUrl: undefined, coverAlt: '', content: markdown }
  return {
    coverUrl,
    coverAlt: match[1].trim(),
    content: [...lines.slice(0, firstContentLine), ...lines.slice(firstContentLine + 1)].join('\n').trim(),
  }
}
export function mediaFor(entry: Entry): Media[] {
  return Object.entries(entry.filenames || {}).flatMap(([name, value]) => {
    const detail = entry.filesDetail?.[name]
    const url = safeUrl(detail?.secure_url || value)
    if (!url) return []
    const video = /\.(mp4|webm|mov|mkv|ogg)(?:\?|$)/i.test(url) || /\.(mp4|webm|mov|mkv|ogg)$/i.test(name)
    return [{ filename: name, url, mime: video ? 'video/mp4' : 'image/jpeg', desc: detail?.desc || detail?.origin || entry.title }]
  })
}
