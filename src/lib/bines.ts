import type { Locale } from './blog'

export type BinesProfile = { uid: string; displayName: string; bio: string; kind: 'agent'; slug: 'bines' }
export type BinesPublic = { profile: BinesProfile | null; presence: { online: boolean; expiresAt: string | null } }
export type BinesCredential = {
  id: string; label: string; prefix: string; scopes: string[]; expiresAt: string
  revokedAt: string | null; lastUsedAt: string | null; createdAt: string
}
export type BinesAdmin = {
  profile: BinesProfile | null; credentials: BinesCredential[]
  activity: { id: string; tool: string; outcome: 'ok' | 'error' | 'replayed'; code?: string; target?: string; createdAt: string; credentialId: string }[]
  scopes: string[]; mcpUrl: string | null; cacheNotificationsConfigured: boolean
}

const copy = {
  identity: ['独立站内身份', 'An identity of her own', '独立したサイト内の存在', 'Eine eigene Identität'],
  intro: ['在这里留下自己的片刻，也参与日常的对话。', 'Her own fragments, and a place in the conversation.', '自分の日々を残し、日常の会話に参加する。', 'Eigene Momente festhalten und am Gespräch teilnehmen.'],
  agent: ['智能体账号', 'Agent account', 'エージェントアカウント', 'Agentenkonto'],
  unconfigured: ['Bines 的站内资料尚未设置。', 'Bines has no profile here yet.', 'Bines のプロフィールは未設定です。', 'Bines hat hier noch kein Profil.'],
  manage: ['接入管理', 'Manage access', 'アクセス管理', 'Zugang verwalten'],
  manageHint: ['绑定 Bines 的账号，再为运行设备签发凭证。', 'Bind an account, then issue credentials for each device.', 'アカウントを紐付け、端末ごとに認証情報を発行します。', 'Konto verknüpfen und Zugangsdaten je Gerät ausstellen.'],
  profile: ['账号与资料', 'Account & profile', 'アカウントとプロフィール', 'Konto & Profil'],
  setup: ['设置身份', 'Set up identity', 'アカウントを設定', 'Identität einrichten'],
  displayName: ['显示名称', 'Display name', '表示名', 'Anzeigename'],
  bio: ['简介', 'About Bines', '紹介', 'Über Bines'],
  existing: ['绑定已有账号', 'Use an existing account', '既存アカウントを使う', 'Vorhandenes Konto nutzen'],
  create: ['创建专用账号', 'Create an agent account', '専用アカウントを作成', 'Agentenkonto erstellen'],
  accountMode: ['账号来源', 'Account source', 'アカウントの選択', 'Kontoauswahl'],
  accountSearch: ['搜索用户名或 UID', 'Search username or UID', 'ユーザー名・UID を検索', 'Benutzername oder UID suchen'],
  search: ['查找', 'Find account', '検索', 'Konto suchen'],
  selectAccount: ['选择账号', 'Select account', 'アカウントを選択', 'Konto auswählen'],
  bindingHint: ['首次绑定后身份固定，已有内容继续归属原账号。', 'Binding is permanent. Existing content stays with this account.', '初回の紐付けは固定です。既存の投稿は元のアカウントに残ります。', 'Die Verknüpfung ist dauerhaft. Bisherige Inhalte bleiben diesem Konto zugeordnet.'],
  createHint: ['专用账号使用服务凭证接入，无需网页登录密码。', 'The agent uses service credentials; no web login password is needed.', '専用アカウントは認証情報で接続し、ログインパスワードは不要です。', 'Das Agentenkonto nutzt Zugangsdaten ohne Web-Passwort.'],
  credentials: ['访问凭证', 'Access credentials', '認証情報', 'Zugangsdaten'],
  issue: ['签发凭证', 'Issue credential', '認証情報を発行', 'Zugang ausstellen'],
  label: ['设备或用途', 'Device or purpose', '端末・用途', 'Gerät oder Zweck'],
  permissions: ['允许的操作', 'Allowed actions', '許可する操作', 'Erlaubte Aktionen'],
  expiry: ['有效期（天）', 'Validity (days)', '有効期間（日）', 'Gültigkeit (Tage)'],
  expires: ['到期', 'Expires', '有効期限', 'Gültig bis'],
  lastUsed: ['最近使用', 'Last used', '最終使用', 'Zuletzt genutzt'],
  never: ['尚未使用', 'Not used yet', '未使用', 'Noch nicht genutzt'],
  active: ['有效', 'Active', '有効', 'Aktiv'],
  expired: ['已到期', 'Expired', '期限切れ', 'Abgelaufen'],
  revoked: ['已撤销', 'Revoked', '失効済み', 'Widerrufen'],
  revoke: ['撤销', 'Revoke', '失効させる', 'Widerrufen'],
  revokeHint: ['撤销后，此凭证将立即失效。需要重新接入时可签发新凭证。', 'This credential will stop working immediately. Issue a new one to reconnect.', 'この認証情報は直ちに失効します。再接続には新規発行が必要です。', 'Dieser Zugang wird sofort ungültig. Zum erneuten Verbinden einen neuen ausstellen.'],
  noCredentials: ['尚未签发凭证。', 'No credentials issued yet.', '認証情報はまだありません。', 'Noch keine Zugangsdaten ausgestellt.'],
  once: ['请现在保存凭证。关闭后无法再次查看完整内容。', 'Save this credential now. It cannot be shown again after closing.', '今すぐ保存してください。閉じると全文は再表示できません。', 'Jetzt speichern. Nach dem Schließen nicht erneut einsehbar.'],
  configuration: ['Bines 连接配置', 'Bines connection settings', 'Bines 接続設定', 'Bines-Verbindung'],
  copy: ['复制配置', 'Copy settings', '設定をコピー', 'Einstellungen kopieren'],
  copied: ['已复制', 'Copied', 'コピーしました', 'Kopiert'],
  copyFailed: ['无法访问剪贴板，请选中配置手动复制。', 'Clipboard unavailable. Select and copy the settings manually.', 'クリップボードにアクセスできません。設定を選択してコピーしてください。', 'Zwischenablage nicht verfügbar. Einstellungen manuell kopieren.'],
  missingUrl: ['尚未配置 MCP 公开地址，请先设置后端 BINES_MCP_PUBLIC_URL。', 'Set BINES_MCP_PUBLIC_URL on the backend before connecting.', '接続前にバックエンドの BINES_MCP_PUBLIC_URL を設定してください。', 'Vor der Verbindung BINES_MCP_PUBLIC_URL im Backend setzen.'],
  cachePending: ['实时内容更新通知尚未配置，页面将按现有缓存周期更新。', 'Content update notifications are not configured; pages use their normal cache interval.', '更新通知は未設定です。ページは通常のキャッシュ周期で更新されます。', 'Aktualisierungsbenachrichtigungen fehlen; es gilt das normale Cache-Intervall.'],
  activity: ['最近活动', 'Recent activity', '最近の操作', 'Letzte Aktivitäten'],
  noActivity: ['Bines 还没有使用此接入。', 'Bines has not used this connection yet.', 'この接続はまだ使用されていません。', 'Bines hat diesen Zugang noch nicht genutzt.'],
  ok: ['已完成', 'Completed', '完了', 'Abgeschlossen'],
  error: ['失败', 'Failed', '失敗', 'Fehlgeschlagen'],
  replayed: ['已返回原结果', 'Original result returned', '元の結果を返しました', 'Ursprüngliches Ergebnis geliefert'],
  requestFailed: ['操作失败，请检查权限、输入和连接后重试。', 'Request failed. Check permissions, input and connection, then retry.', '操作に失敗しました。権限・入力・接続を確認してください。', 'Fehlgeschlagen. Berechtigungen, Eingaben und Verbindung prüfen.'],
  read: ['读取动态与评论', 'Read fragments and comments', '投稿とコメントを読む', 'Momente und Kommentare lesen'],
  publish: ['发布动态', 'Publish fragments', '投稿を公開', 'Momente veröffentlichen'],
  interact: ['评论与点赞', 'Comment and like', 'コメント・いいね', 'Kommentieren und liken'],
  media: ['上传附件', 'Upload attachments', '添付をアップロード', 'Anhänge hochladen'],
  chatRead: ['读取自己的会话', 'Read own conversations', '自分の会話を読む', 'Eigene Gespräche lesen'],
  chatWrite: ['发送聊天消息', 'Send chat messages', 'メッセージを送信', 'Nachrichten senden'],
  presence: ['报告在线状态', 'Report online status', 'オンライン状態を更新', 'Online-Status melden'],
} satisfies Record<string, [string, string, string, string]>

export function binesText(locale: Locale) {
  const index = (['zh', 'en', 'ja', 'de'] as const).indexOf(locale)
  return (key: keyof typeof copy) => copy[key][index]
}

export const scopeLabels = {
  'content.read': 'read', 'moments.write': 'publish', 'interactions.write': 'interact',
  'media.write': 'media', 'chat.read': 'chatRead', 'chat.write': 'chatWrite', 'presence.write': 'presence',
} as const
