'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWRInfinite from 'swr/infinite'
import { Maximize2, Minimize2, Reply, Send, X } from 'lucide-react'
import { dateLabel, Envelope, excerpt, Media } from '@/lib/blog'
import { request, send, useBlog, useBlogData } from './blog-provider'
import { FilePicker, MediaGrid, PageHeading, RequireLogin, State, styles } from './shared'

type Conversation = { id: string; label?: string; type: 'group' | 'private' }
type Message = { _id: string; uid: string; username: string; text: string; imgurl?: string[] | string; replyto?: string; createdAt: string }
type ChatEvent = { chatType: 'group' | 'private'; convKey?: string; data: Message }

function ConversationView({ conversation, expanded, toggleExpanded }: {
  conversation: Conversation
  expanded: boolean
  toggleExpanded: () => void
}) {
  const { t, locale, session, connection } = useBlog()
  const [content, setContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploaded, setUploaded] = useState<string[]>([])
  const [reply, setReply] = useState<Message | null>(null)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [incoming, setIncoming] = useState<Message[]>([])
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stickToBottom = useRef(true)
  const olderPosition = useRef<{ height: number; top: number } | null>(null)
  const base = `chat/history?type=${conversation.type}&userId=${encodeURIComponent(conversation.id)}&account=${session!.uid}&limit=15`
  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite<Envelope<Message[]>>(
    (index, previous) => previous && !previous.hasMore ? null : `${base}&page=${index + 1}`,
    request,
    { revalidateAll: true, refreshInterval: connection === 'connected' ? 0 : 15000 },
  )
  const byId = new Map<string, Message>()
  for (const page of data || []) for (const message of page.data) byId.set(message._id, message)
  for (const message of incoming) byId.set(message._id, message)
  const messages = [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a._id.localeCompare(b._id))
  const latest = messages.at(-1)?._id
  const hasMore = data?.at(-1)?.hasMore
  const keepLatestVisible = useCallback(() => {
    const scroller = messagesRef.current
    if (scroller && stickToBottom.current) scroller.scrollTop = scroller.scrollHeight
  }, [])
  useEffect(() => {
    const onMessage = (event: Event) => {
      const payload = (event as CustomEvent<ChatEvent>).detail
      const isCurrent = payload.chatType === 'group' ? conversation.type === 'group' : payload.convKey === conversation.id
      if (!isCurrent || !payload.data?._id) return
      setIncoming(previous => [...previous.filter(message => message._id !== payload.data._id), payload.data])
      void mutate()
    }
    window.addEventListener('ark:chat', onMessage)
    return () => window.removeEventListener('ark:chat', onMessage)
  }, [conversation.id, conversation.type, mutate])
  useEffect(() => { if (connection === 'connected') void mutate() }, [connection, mutate])
  useEffect(() => {
    const scroller = messagesRef.current
    if (!scroller) return
    if (olderPosition.current && !isValidating) {
      scroller.scrollTop = olderPosition.current.top + scroller.scrollHeight - olderPosition.current.height
      olderPosition.current = null
    } else if (stickToBottom.current) {
      scroller.scrollTop = scroller.scrollHeight
    }
  }, [latest, messages.length, isValidating])
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const hasContent = content.trim() || files.length || uploaded.length
    if (busy || !hasContent) return
    setBusy(true); setSubmitError('')
    try {
      let urls = uploaded
      if (files.length) {
        const form = new FormData()
        for (const file of files) form.append('files', file)
        const result = await send<Envelope<{ urls: string[] }>>('chat/upload', form)
        urls = [...urls, ...result.data.urls]
        setUploaded(urls); setFiles([])
        if (result.data.urls.length !== files.length) {
          setSubmitError(t('chatPartialUpload'))
          return
        }
      }
      const result = await send<Envelope<Message>>('chat/send', { type: conversation.type, targetUserId: conversation.id, text: content.trim(), imgurl: urls, replyto: reply ? `${reply.username}: ${excerpt(reply.text, 200) || t('image')}` : '' })
      stickToBottom.current = true
      setIncoming(previous => [...previous, result.data])
      setContent(''); setReply(null); setUploaded([])
      await mutate()
    } catch (error) { setSubmitError((error as Error).message) } finally { setBusy(false) }
  }
  const label = conversation.id === 'group' ? t('group') : conversation.id === 'admin' ? t('admin') : conversation.label || conversation.id
  const expandLabel = t(expanded ? 'collapseChat' : 'expandChat')
  return <section className={styles['chat-main']} aria-label={label}>
    <div className={styles['chat-status']} title={label}><strong>{label}</strong><span aria-hidden="true">·</span><span role="status">{t(connection === 'connected' ? 'connected' : 'reconnecting')}</span><button type="button" className={`${styles['icon-button']} ${styles['chat-expand']}`} aria-label={expandLabel} title={expandLabel} aria-pressed={expanded} onClick={toggleExpanded}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button></div>
    <div className={styles['messages']} ref={messagesRef} role="log" aria-label={label} aria-live="polite" onScroll={() => { const el = messagesRef.current!; stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60 }}>
      {hasMore && <div className={styles['older-messages']}><button className={styles['secondary-button']} disabled={isValidating} onClick={() => { const el = messagesRef.current!; olderPosition.current = { height: el.scrollHeight, top: el.scrollTop }; stickToBottom.current = false; void setSize(size + 1) }}>{t('older')}</button></div>}
      <State loading={isLoading} error={error} empty={!!data && !messages.length} retry={() => mutate()} />
      {messages.map(message => {
        const urls = Array.isArray(message.imgurl) ? message.imgurl : message.imgurl ? [message.imgurl] : []
        const media: Media[] = urls.filter(url => /^https?:\/\//.test(url)).map(url => ({ url, filename: url.split('/').pop() || '', mime: /\.(mp4|webm|mov|mkv|ogg)(?:\?|$)/i.test(url) ? 'video/mp4' : 'image/jpeg' }))
        return <article key={message._id} className={styles['message']} data-own={message.uid === session!.uid} data-media={media.length ? 'true' : 'false'}><small title={message.username}>{message.username} · {dateLabel(message.createdAt, locale)} {new Date(message.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</small>{message.replyto && <blockquote>{message.replyto}</blockquote>}{message.text && <p>{message.text}</p>}<MediaGrid files={media} compact onMediaLoad={keepLatestVisible} /><button className={`${styles['icon-button']} ${styles['message-reply']}`} aria-label={`${t('reply')} ${message.username}`} title={t('reply')} onClick={() => { setReply(message); inputRef.current?.focus() }}><Reply size={14} /></button></article>
      })}
    </div>
    <form className={styles['chat-compose']} onSubmit={submit}>
      {reply && <div className={styles['reply-target']}><span>{t('reply')} {reply.username}: {excerpt(reply.text, 80)}</span><button type="button" className={styles['icon-button']} onClick={() => setReply(null)} aria-label={t('cancel')}><X size={16} /></button></div>}
      <label className={styles['field']}>{t('content')}<textarea ref={inputRef} rows={2} maxLength={10000} value={content} onChange={e => setContent(e.target.value)} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }} /></label>
      <div className={styles['form-actions']}><FilePicker files={files} setFiles={setFiles} max={Math.max(0, 9 - uploaded.length)} /><button className={styles['primary-button']} disabled={busy || (!content.trim() && !files.length && !uploaded.length)}><Send size={15} />{t(busy ? 'sending' : 'send')}</button></div>
      {!!uploaded.length && <div className={styles['form-actions']}><span className={styles['form-note']}>{uploaded.length} {t('mediaReady')}</span><button type="button" className={styles['secondary-button']} disabled={busy} onClick={() => setUploaded([])}>{t('cancel')}</button></div>}
      {submitError && <p className={styles['error']} role="alert">{submitError}</p>}
    </form>
  </section>
}

function ChatContent({ expanded, toggleExpanded }: { expanded: boolean; toggleExpanded: () => void }) {
  const { t, session } = useBlog()
  const router = useRouter()
  const params = useSearchParams()
  const active = params.get('conversation') || 'group'
  const { data, error, isLoading, mutate } = useBlogData<Envelope<Conversation[]>>(`chat/conversations?account=${session!.uid}`)
  const conversation = data?.data.find(item => item.id === active)
  useEffect(() => {
    if (!params.has('legacyPrivate') || !data) return
    let label = location.hash.slice(1)
    try { label = decodeURIComponent(label) } catch { /* Preserve malformed historical anchors as plain text. */ }
    const target = data.data.find(item => item.type === 'private' && (item.label === label || item.id === label))
      || data.data.find(item => item.id === 'admin')
    if (target) router.replace(`/chat?conversation=${encodeURIComponent(target.id)}`, { scroll: false })
  }, [data, params, router])
  useEffect(() => {
    const onMessage = () => { void mutate() }
    window.addEventListener('ark:chat', onMessage)
    return () => window.removeEventListener('ark:chat', onMessage)
  }, [mutate])
  return <><State loading={isLoading} error={error} retry={() => mutate()} />{data && <div className={styles['chat-layout']}><nav className={styles['conversation-list']} aria-label={t('chat')}>{data.data.map(item => {
    const label = item.id === 'group' ? t('group') : item.id === 'admin' ? t('admin') : item.label || item.id
    return <button key={item.id} title={label} aria-pressed={active === item.id} onClick={() => router.replace(`/chat?conversation=${encodeURIComponent(item.id)}`, { scroll: false })}><span>{label}</span></button>
  })}</nav>{conversation ? <ConversationView key={`${session!.uid}:${conversation.id}`} conversation={conversation} expanded={expanded} toggleExpanded={toggleExpanded} /> : <State empty />}</div>}</>
}

export default function Chat() {
  const { session } = useBlog()
  const [expanded, setExpanded] = useState(false)
  useEffect(() => {
    if (!expanded) return
    const collapse = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', collapse)
    return () => window.removeEventListener('keydown', collapse)
  }, [expanded])
  return <div className={`${styles['page']} ${styles['chat-page']}`} data-expanded={expanded}><PageHeading title="chat" english="Across the distance" number="07" /><RequireLogin guestAllowed><ChatContent key={session?.uid} expanded={expanded} toggleExpanded={() => setExpanded(value => !value)} /></RequireLogin></div>
}
