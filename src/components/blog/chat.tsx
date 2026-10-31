'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useSWRInfinite from 'swr/infinite'
import { useVirtualizer, type VirtualItem, type Virtualizer } from '@tanstack/react-virtual'
import { ArrowLeft, ChevronRight, Maximize2, MessageCircle, Minimize2, Reply, Send, UsersRound, X } from 'lucide-react'
import { dateLabel, Envelope, excerpt, Media, type Locale } from '@/lib/blog'
import { observeVisualViewport } from '@/lib/visual-viewport'
import { request, send, useBlog, useBlogData } from './blog-provider'
import { useManagedUploads, type UploadedAsset } from './media-upload'
import { FilePicker, MediaGrid, PageHeading, RequireLogin, State, styles } from './shared'
import mobile from './chat-mobile.module.scss'

type Conversation = { id: string; label?: string; type: 'group' | 'private' }
type Message = { _id: string; uid: string; username: string; text: string; imgurl?: string[] | string; replyto?: string; createdAt: string }
type ChatEvent = { chatType: 'group' | 'private'; convKey?: string; data: Message }
type SenderStyle = CSSProperties & { '--sender-hue': number }
type ConversationMemory = {
  content: string; reply: Message | null; files: File[]; assets: UploadedAsset[]
  scrollTop: number; atBottom: boolean; pages: number; measurements: VirtualItem[]
}
const mobileCopy: Record<Locale, { back: string; choose: string; group: string; private: string }> = {
  zh: { back: '返回会话', choose: '选择一个会话，开始聊天', group: '公共聊天室', private: '私信会话' },
  en: { back: 'Back to chats', choose: 'Choose a conversation to start chatting', group: 'Public conversation', private: 'Private conversation' },
  ja: { back: '会話一覧に戻る', choose: '会話を選んでチャットを始めましょう', group: '公開チャット', private: 'プライベートチャット' },
  de: { back: 'Zur Chatliste', choose: 'Wähle einen Chat, um zu schreiben', group: 'Öffentlicher Chat', private: 'Privater Chat' },
}
const phoneQuery = '(max-width: 640px)'
function subscribePhone(listener: () => void) {
  const query = window.matchMedia(phoneQuery)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
const isPhone = () => window.matchMedia(phoneQuery).matches
const serverIsPhone = () => false

function senderStyle(username: string): SenderStyle {
  let hash = 2166136261
  for (const character of username.trim().toLowerCase()) {
    hash ^= character.codePointAt(0) || 0
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  return { '--sender-hue': (hash >>> 0) % 360 }
}

const estimateMessageSize = () => 112
function measureMessageElement(element: Element, _entry: ResizeObserverEntry | undefined, virtualizer: Virtualizer<HTMLDivElement, Element>) {
  const height = element.getBoundingClientRect().height
  // Returning to the list hides this room. A zero-size ResizeObserver entry
  // must not erase measurements needed when the same room is shown again.
  if (height) return height
  const index = Number(element.getAttribute('data-index'))
  return virtualizer.itemSizeCache.get(virtualizer.options.getItemKey(index)) ?? estimateMessageSize()
}

function ConversationView({ conversation, expanded, toggleExpanded, backToChats, visible, memories, setNavigationBusy }: {
  conversation: Conversation
  expanded: boolean
  toggleExpanded: () => void
  backToChats: () => void
  visible: boolean
  memories: Map<string, ConversationMemory>
  setNavigationBusy: (busy: boolean) => void
}) {
  const { t, locale, session, connection } = useBlog()
  const [initialMemory] = useState(() => memories.get(conversation.id))
  const [content, setContent] = useState(initialMemory?.content || '')
  const [reply, setReply] = useState<Message | null>(initialMemory?.reply || null)
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [incoming, setIncoming] = useState<Message[]>([])
  const uploads = useManagedUploads('chat')
  const { setFiles, restoreAssets } = uploads
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const stickToBottom = useRef(initialMemory?.atBottom ?? true)
  const restoringPosition = useRef(true)
  const userScrolling = useRef(false)
  const scrollIdle = useRef<ReturnType<typeof setTimeout> | null>(null)
  const olderPosition = useRef<{ height: number; top: number } | null>(null)
  const base = `chat/history?type=${conversation.type}&userId=${encodeURIComponent(conversation.id)}&account=${session!.uid}&limit=15`
  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite<Envelope<Message[]>>(
    (index, previous) => previous && !previous.hasMore ? null : `${base}&page=${index + 1}`,
    request,
    { initialSize: initialMemory?.pages || 1, revalidateAll: true, refreshInterval: connection === 'connected' ? 0 : 15000 },
  )
  const messages = useMemo(() => {
    const byId = new Map<string, Message>()
    for (const page of data || []) for (const message of page.data) byId.set(message._id, message)
    for (const message of incoming) byId.set(message._id, message)
    return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a._id.localeCompare(b._id))
  }, [data, incoming])
  const latest = messages.at(-1)?._id
  const hasMore = data?.at(-1)?.hasMore
  const getMessageKey = useCallback((index: number) => messages[index]?._id || index, [messages])
  const getMessagesElement = useCallback(() => messagesRef.current, [])
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: getMessagesElement,
    estimateSize: estimateMessageSize,
    measureElement: measureMessageElement,
    getItemKey: getMessageKey,
    initialOffset: initialMemory?.scrollTop || 0,
    initialMeasurementsCache: initialMemory?.measurements,
    useAnimationFrameWithResizeObserver: true,
    overscan: 6,
    directDomUpdates: true,
  })
  const keepLatestVisible = useCallback(() => {
    if (messagesRef.current?.clientHeight && stickToBottom.current) virtualizer.scrollToEnd()
  }, [virtualizer])
  useEffect(() => {
    setNavigationBusy(busy || uploads.isUploading)
    return () => setNavigationBusy(false)
  }, [busy, uploads.isUploading, setNavigationBusy])
  useEffect(() => {
    if (!initialMemory) return
    setFiles(initialMemory.files)
    restoreAssets(initialMemory.assets)
  }, [initialMemory, setFiles, restoreAssets])
  useEffect(() => {
    const previous = memories.get(conversation.id)
    memories.set(conversation.id, {
      content, reply,
      // Completed assets are restored once; only files not uploaded yet need
      // to rejoin the queue when a conversation is opened again.
      files: uploads.items.flatMap(item => item.file && !item.asset ? [item.file] : []),
      assets: uploads.assets,
      scrollTop: previous?.scrollTop ?? initialMemory?.scrollTop ?? 0,
      atBottom: stickToBottom.current,
      pages: size,
      measurements: virtualizer.takeSnapshot(),
    })
  }, [content, reply, uploads.items, uploads.assets, size, conversation.id, initialMemory, memories, virtualizer])
  useEffect(() => {
    if (visible && isPhone()) backRef.current?.focus({ preventScroll: true })
  }, [visible])
  useEffect(() => {
    if (!visible) { restoringPosition.current = true; return }
    if (!data || !restoringPosition.current) return
    const frame = requestAnimationFrame(() => {
      if (!messagesRef.current?.clientHeight) return
      const saved = memories.get(conversation.id)
      if (stickToBottom.current) virtualizer.scrollToEnd()
      else virtualizer.scrollToOffset(saved?.scrollTop ?? initialMemory?.scrollTop ?? 0)
      restoringPosition.current = false
    })
    return () => cancelAnimationFrame(frame)
  }, [visible, data, conversation.id, initialMemory, memories, virtualizer])
  function recordScrollIntent() { userScrolling.current = true }
  function recordScrollPosition() {
    const scroller = messagesRef.current
    if (!scroller?.clientHeight || restoringPosition.current) return
    const saved = memories.get(conversation.id)
    if (saved) {
      saved.scrollTop = scroller.scrollTop
      saved.measurements = virtualizer.takeSnapshot()
    }
    // Virtualizer measurements also dispatch scroll events. Only a user
    // gesture can opt out of following the latest message.
    if (!userScrolling.current) return
    stickToBottom.current = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 60
    if (saved) saved.atBottom = stickToBottom.current
    if (scrollIdle.current) clearTimeout(scrollIdle.current)
    scrollIdle.current = setTimeout(() => { userScrolling.current = false }, 150)
  }
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
      keepLatestVisible()
    }
  }, [latest, messages.length, isValidating, keepLatestVisible])
  useEffect(() => {
    const scroller = messagesRef.current
    if (!scroller) return
    // Keyboard, orientation and attachment changes resize the log independently
    // of its messages. Preserve the user's position unless they were at the end.
    const observer = new ResizeObserver(keepLatestVisible)
    observer.observe(scroller)
    const list = scroller.querySelector(`.${styles['virtual-message-list']}`)
    if (list) observer.observe(list)
    return () => {
      observer.disconnect()
      if (scrollIdle.current) clearTimeout(scrollIdle.current)
    }
  }, [keepLatestVisible])
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const hasContent = content.trim() || uploads.items.length
    if (busy || !hasContent) return
    setBusy(true); setSubmitError('')
    try {
      const assets = await uploads.uploadAll()
      const result = await send<Envelope<Message>>('chat/send', { type: conversation.type, targetUserId: conversation.id, text: content.trim(), assetIds: assets.map(asset => asset.id), replyto: reply ? `${reply.username}: ${excerpt(reply.text, 200) || t('image')}` : '' })
      stickToBottom.current = true
      userScrolling.current = false
      setIncoming(previous => [...previous, result.data])
      setContent(''); setReply(null); uploads.reset()
      await mutate()
    } catch (error) { setSubmitError((error as Error).message) } finally { setBusy(false) }
  }
  const label = conversation.id === 'group' ? t('group') : conversation.id === 'admin' ? t('admin') : conversation.label || conversation.id
  const expandLabel = t(expanded ? 'collapseChat' : 'expandChat')
  const restoredAssets = uploads.items.filter(item => !item.file && item.asset)
  return <section className={`${styles['chat-main']} ${mobile.thread}`} aria-label={label}>
    <div className={`${styles['chat-status']} ${mobile.status}`} title={label}>
      <button ref={backRef} type="button" className={mobile.back} aria-label={mobileCopy[locale].back} title={mobileCopy[locale].back} disabled={busy || uploads.isUploading} onClick={backToChats}><ArrowLeft size={19} aria-hidden="true" /><span>{mobileCopy[locale].back}</span></button>
      <div className={mobile.identity}><strong>{label}</strong><span role="status">{t(connection === 'connected' ? 'connected' : 'reconnecting')}</span></div>
      <button type="button" className={`${styles['icon-button']} ${styles['chat-expand']}`} aria-label={expandLabel} title={expandLabel} aria-pressed={expanded} onClick={toggleExpanded}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
    </div>
    <span className={styles['sr-only']} aria-live="polite">{messages.at(-1)?.text || (messages.at(-1)?.imgurl ? t('image') : '')}</span>
    <div className={styles['messages']} ref={messagesRef} role="log" aria-label={label}
      onWheel={recordScrollIntent} onTouchMove={recordScrollIntent}
      onPointerDown={recordScrollIntent}
      onKeyDown={event => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) recordScrollIntent() }}
      onScroll={recordScrollPosition}>
      {hasMore && <div className={styles['older-messages']}><button className={styles['secondary-button']} disabled={isValidating} onClick={() => { const el = messagesRef.current!; olderPosition.current = { height: el.scrollHeight, top: el.scrollTop }; stickToBottom.current = false; void setSize(size + 1) }}>{t('older')}</button></div>}
      <State loading={isLoading} error={error} empty={!!data && !messages.length} retry={() => mutate()} />
      <div ref={virtualizer.containerRef} className={styles['virtual-message-list']}>{virtualizer.getVirtualItems().map(virtualRow => {
        const message = messages[virtualRow.index]
        const urls = Array.isArray(message.imgurl) ? message.imgurl : message.imgurl ? [message.imgurl] : []
        const media: Media[] = urls.filter(url => /^https?:\/\//.test(url)).map(url => ({ url, filename: url.split('/').pop() || '', mime: /\.(mp4|webm|mov|mkv|ogg)(?:\?|$)/i.test(url) ? 'video/mp4' : 'image/jpeg' }))
        const own = message.uid === session!.uid
        return <div key={message._id} ref={virtualizer.measureElement} data-index={virtualRow.index} data-message-id={message._id} className={styles['message-row']} data-own={own}>
          <article className={styles['message']} data-own={own} style={senderStyle(message.username)}>
            <small className={styles['message-meta']} title={message.username}>{message.username} · {dateLabel(message.createdAt, locale)} {new Date(message.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</small>
            {message.replyto && <blockquote className={styles['message-quote']}>{message.replyto}</blockquote>}
            <div className={styles['message-line']}>
              <div className={styles['message-body']}>
                {message.text && <p>{message.text}</p>}
                <MediaGrid files={media} compact onMediaLoad={keepLatestVisible} />
              </div>
              <button type="button" className={`${styles['icon-button']} ${styles['message-reply']}`} aria-label={`${t('reply')} ${message.username}`} title={t('reply')} onClick={() => { setReply(message); inputRef.current?.focus() }}><Reply size={14} /></button>
            </div>
          </article>
        </div>
      })}</div>
    </div>
    <form className={styles['chat-compose']} onSubmit={submit}>
      {reply && <div className={styles['reply-target']}><span>{t('reply')} {reply.username}: {excerpt(reply.text, 80)}</span><button type="button" className={styles['icon-button']} onClick={() => setReply(null)} aria-label={t('cancel')}><X size={16} /></button></div>}
      <label className={styles['field']}>{t('content')}<textarea ref={inputRef} rows={2} maxLength={10000} value={content} onChange={e => setContent(e.target.value)} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }} /></label>
      {restoredAssets.length > 0 && <ul className={mobile.restoredFiles}>{restoredAssets.map(item => <li key={item.key}><span>{item.asset!.filename}</span><button type="button" className={styles['icon-button']} aria-label={`${t('removeFile')} ${item.asset!.filename}`} onClick={() => uploads.remove(item.key)}><X size={16} /></button></li>)}</ul>}
      <div className={styles['form-actions']}><FilePicker files={uploads.files} setFiles={uploads.setFiles} uploadItems={uploads.items} onRetry={key => { void uploads.retry(key).catch(uploadError => setSubmitError((uploadError as Error).message)) }} onRemove={uploads.remove} max={9 - restoredAssets.length} /><button className={styles['primary-button']} disabled={busy || uploads.isUploading || (!content.trim() && !uploads.items.length)}><Send size={15} />{t(busy ? 'sending' : 'send')}</button></div>
      {submitError && <p className={styles['error']} role="alert">{submitError}</p>}
    </form>
  </section>
}

function ChatContent({ expanded, toggleExpanded }: { expanded: boolean; toggleExpanded: () => void }) {
  const { t, locale, session } = useBlog()
  const router = useRouter()
  const params = useSearchParams()
  const [lastActive, setLastActive] = useState(params.get('conversation') || 'group')
  const active = params.get('conversation') || lastActive
  const threadOpen = !!params.get('conversation')
  const phone = useSyncExternalStore(subscribePhone, isPhone, serverIsPhone)
  const visible = !phone || threadOpen
  const [memories] = useState(() => new Map<string, ConversationMemory>())
  const [navigationBusy, setNavigationBusy] = useState(false)
  const conversationList = useRef<HTMLElement>(null)
  const returnFocus = useRef<string | null>(null)
  const { data, error, isLoading, mutate } = useBlogData<Envelope<Conversation[]>>(`chat/conversations?account=${session!.uid}`)
  const conversation = data?.data.find(item => item.id === active)
  function selectConversation(id: string) {
    setLastActive(id)
    router.replace(`/chat?conversation=${encodeURIComponent(id)}`, { scroll: false })
  }
  function backToChats() {
    setLastActive(active)
    returnFocus.current = active
    router.replace('/chat', { scroll: false })
  }
  useEffect(() => {
    if (threadOpen || !returnFocus.current) return
    const button = [...(conversationList.current?.querySelectorAll<HTMLButtonElement>('button[data-conversation]') || [])]
      .find(item => item.dataset.conversation === returnFocus.current)
    button?.focus({ preventScroll: true })
    returnFocus.current = null
  }, [threadOpen])
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
  return <><State loading={isLoading} error={error} retry={() => mutate()} />{data && <div className={`${styles['chat-layout']} ${mobile.layout}`} data-mobile-thread={threadOpen} data-chat-view={threadOpen ? 'thread' : 'list'}>
    <nav ref={conversationList} className={`${styles['conversation-list']} ${mobile.conversations}`} aria-label={t('chat')}>
      <p className={mobile.listHint}>{mobileCopy[locale].choose}</p>
      {data.data.map(item => {
    const label = item.id === 'group' ? t('group') : item.id === 'admin' ? t('admin') : item.label || item.id
    return <button key={item.id} type="button" data-conversation={item.id} title={label} aria-label={label} aria-pressed={visible && active === item.id} disabled={navigationBusy} onClick={() => selectConversation(item.id)}>
      <span className={styles['conversation-symbol']} aria-hidden="true">{item.type === 'group' ? <UsersRound size={17} strokeWidth={1.3} /> : <MessageCircle size={17} strokeWidth={1.3} />}</span>
      <span className={mobile.conversationCopy}><span>{label}</span><small>{mobileCopy[locale][item.type]}</small></span>
      <ChevronRight className={mobile.chevron} size={17} aria-hidden="true" />
    </button>
  })}</nav>
    {conversation ? <ConversationView key={`${session!.uid}:${conversation.id}`} conversation={conversation} expanded={expanded} toggleExpanded={toggleExpanded} backToChats={backToChats} visible={visible} memories={memories} setNavigationBusy={setNavigationBusy} /> : <section className={mobile.thread}><button type="button" className={mobile.back} onClick={backToChats}><ArrowLeft size={19} aria-hidden="true" />{mobileCopy[locale].back}</button><State empty /></section>}
  </div>}</>
}

export default function Chat() {
  const { session } = useBlog()
  const [expanded, setExpanded] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = pageRef.current?.closest<HTMLElement>(`.${styles['blog-root']}`)
    if (!root) return
    return observeVisualViewport(root, 'chat')
  }, [])
  useEffect(() => {
    if (!expanded) return
    const collapse = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', collapse)
    return () => window.removeEventListener('keydown', collapse)
  }, [expanded])
  return <div ref={pageRef} className={`${styles['page']} ${styles['chat-page']} ${mobile.page}`} data-expanded={expanded}><PageHeading title="chat" english="Across the distance" number="07" /><RequireLogin guestAllowed><ChatContent key={session?.uid} expanded={expanded} toggleExpanded={() => setExpanded(value => !value)} /></RequireLogin></div>
}
