'use client'

import { townLawMarkdown } from '@/lib/community-rules'
import { homeAnnouncementMarkdown } from '@/lib/legacy-announcements'
import { useBlog } from './blog-provider'
import { Markdown, PageHeading, styles } from './shared'

const notice = {
  zh: '这里是 YororoIce 的新家。文章、片刻、映像与通信沿用原有账号和内容。\n\n图库暂不支持自行删除；如需移除已上传的媒体，请通过关于页联系作者。公开留言提交后不可编辑或删除。\n\n发布或上传时请等待结果，避免重复提交。',
  en: 'Welcome to YororoIce’s new home. Writings, fragments, media and chat use your existing account and content.\n\nGallery media cannot be deleted here. Contact the author through About for removal. Public guestbook entries cannot be edited or deleted after posting.\n\nPlease wait for uploads and posts to finish before trying again.',
  ja: 'YororoIce の新しい場所へようこそ。記事・日々・メディア・チャットは以前のアカウントとコンテンツを引き継いでいます。\n\nギャラリーのメディア削除は作者へご連絡ください。伝言は投稿後に編集・削除できません。\n\n二重投稿を避けるため、アップロードと投稿の完了をお待ちください。',
  de: 'Willkommen im neuen Zuhause von YororoIce. Texte, Momente, Medien und Chat verwenden dein bisheriges Konto und deine Inhalte.\n\nGalerie-Medien können hier nicht gelöscht werden. Wende dich dafür über „Über mich“ an den Autor. Gästebucheinträge können nach dem Senden nicht bearbeitet oder gelöscht werden.\n\nBitte warte, bis Uploads und Beiträge abgeschlossen sind.',
}
const germanRules = `### Community-Regeln

1. Bleibe respektvoll. Keine persönlichen Angriffe, Hassrede, Drohungen oder Belästigung.
2. Schütze die Privatsphäre. Veröffentliche keine sensiblen persönlichen Daten.
3. Kein Spam, Betrug, Phishing oder schädliche Links und Dateien.
4. Respektiere Urheberrechte. Keine Plagiate, Identitätsnachahmung oder unerlaubte Weiterveröffentlichung.
5. Lade nur rechtmäßige Inhalte hoch.
6. Beachte geltende Gesetze und Plattformregeln.

### Hinweise zur Website

1. Dieses persönliche Projekt kann jederzeit angepasst, pausiert oder aktualisiert werden.
2. Funktionen und Datenansichten können sich ändern; zeitweilige Störungen sind möglich.
3. Öffentlich veröffentlichte Inhalte können anderen Nutzern angezeigt werden.
4. Sichere wichtige Inhalte selbst.

### Rechte, Verantwortung und Datenschutz

1. Du bist für die Rechtmäßigkeit und Echtheit deiner Beiträge verantwortlich.
2. Regelwidrige Inhalte können geprüft, verborgen oder entfernt werden.
3. Für Sicherheit und Funktion werden notwendige Konto- und Sitzungsdaten verarbeitet.
4. Automatisierter API-Missbrauch, massenhaftes Datensammeln und Angriffe sind untersagt.

> Verstöße können zur Entfernung von Inhalten, Einschränkung oder Sperrung des Kontos und gegebenenfalls zu rechtlichen Folgen führen.`

export default function Notices({ terms = false }: { terms?: boolean }) {
  const { t, locale } = useBlog()
  const sourceLocale = locale === 'de' ? 'en' : locale
  return <div className={styles['page']}><PageHeading title={terms ? 'terms' : 'notice'} english={terms ? 'A shared agreement' : 'From this place'} number="08" /><div className={styles['reader']}><Markdown content={terms ? locale === 'de' ? germanRules : townLawMarkdown[locale] : notice[locale]} />{!terms && <details><summary className={styles['text-link']}>{t('noticeHistory')}</summary><Markdown content={homeAnnouncementMarkdown[sourceLocale]} /></details>}</div></div>
}
