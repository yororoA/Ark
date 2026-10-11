'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Copy, KeyRound, Pencil, Plus, Search, ShieldOff } from 'lucide-react'
import Link from '@/components/appearance/p3r-link'
import { binesText, scopeLabels, type BinesAdmin, type BinesCredential, type BinesProfile } from '@/lib/bines'
import { dateLabel, type Envelope } from '@/lib/blog'
import { request, send, useBlog } from './blog-provider'
import { BlogSelect } from './controls'
import { Modal, State, styles } from './shared'
import local from './bines.module.scss'

type Refresh = () => Promise<unknown>

function ProfileEditor({ profile, close, refresh }: { profile: BinesProfile | null; close: () => void; refresh: Refresh }) {
  const { locale, t, notify } = useBlog()
  const text = binesText(locale)
  const [mode, setMode] = useState('existing')
  const [name, setName] = useState(profile?.displayName || 'Bines')
  const [bio, setBio] = useState(profile?.bio || '')
  const [uid, setUid] = useState(profile?.uid || '')
  const [query, setQuery] = useState('')
  const [accounts, setAccounts] = useState<{ uid: string; username: string }[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function search() {
    if (busy || !query.trim()) return
    setBusy(true); setError(''); setUid(''); setAccounts(null)
    try {
      const result = await request<Envelope<{ uid: string; username: string }[]>>(`/api/bines/admin/accounts?q=${encodeURIComponent(query.trim())}`)
      setAccounts(result.data)
    } catch { setError(text('requestFailed')) } finally { setBusy(false) }
  }
  const createsAccount = !profile && mode === 'create'
  const canSave = !busy && name.trim() && (createsAccount || uid)
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!canSave) return
    setBusy(true); setError('')
    try {
      await send('/api/bines/admin/profile', {
        ...(createsAccount ? { createAccount: true } : { uid }),
        displayName: name.trim(), bio: bio.trim(),
      }, 'PUT')
      await refresh(); notify(t('saved')); close()
    } catch { setError(text('requestFailed')) } finally { setBusy(false) }
  }
  return <Modal title={text('profile')} close={() => { if (!busy) close() }}>
    <form className={styles['form']} onSubmit={save}>
      <p className={styles['form-note']}>{text('bindingHint')}</p>
      {!profile && <BlogSelect label={text('accountMode')} value={mode} onChange={setMode} options={[
        { value: 'existing', label: text('existing') }, { value: 'create', label: text('create') },
      ]} />}
      {!profile && mode === 'existing' && <>
        <div className={local['search-row']}>
          <label className={styles['field']}>{text('accountSearch')}<input maxLength={60} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void search() } }} /></label>
          <button type="button" className={styles['secondary-button']} disabled={busy || !query.trim()} onClick={search}><Search size={15} />{text('search')}</button>
        </div>
        {accounts?.length ? <BlogSelect label={text('selectAccount')} value={uid} onChange={setUid} options={[
          { value: '', label: text('selectAccount') }, ...accounts.map(account => ({ value: account.uid, label: `${account.username} · ${account.uid}` })),
        ]} /> : <State empty={accounts?.length === 0} />}
      </>}
      {createsAccount && <p className={styles['form-note']}>{text('createHint')}</p>}
      {profile && <p className={local['account-id']}>UID · {profile.uid}</p>}
      <label className={styles['field']}>{text('displayName')}<input required maxLength={60} value={name} onChange={event => setName(event.target.value)} /></label>
      <label className={styles['field']}>{text('bio')}<textarea rows={4} maxLength={500} value={bio} onChange={event => setBio(event.target.value)} /></label>
      {error && <p className={styles['error']} role="alert">{error}</p>}
      <div><button className={styles['primary-button']} disabled={!canSave}>{t(busy ? 'saving' : 'save')}</button></div>
    </form>
  </Modal>
}

function IssueCredential({ scopes, mcpUrl, close, refresh }: { scopes: string[]; mcpUrl: string | null; close: () => void; refresh: Refresh }) {
  const { locale, t } = useBlog()
  const text = binesText(locale)
  const [label, setLabel] = useState('')
  const [days, setDays] = useState('90')
  const [selected, setSelected] = useState(['content.read', 'presence.write'])
  const [issued, setIssued] = useState<{ token: string; credential: BinesCredential } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const config = issued ? `ARK_TRANSPORT=mcp\nARK_MCP_URL=${mcpUrl || ''}\nARK_MCP_TOKEN=${issued.token}\nARK_MCP_TIMEOUT=20` : ''
  async function issue(event: React.FormEvent) {
    event.preventDefault()
    if (busy || !selected.length) return
    setBusy(true); setError('')
    try {
      const result = await send<Envelope<{ token: string; credential: BinesCredential }>>('/api/bines/admin/credentials', { label: label.trim(), scopes: selected, expiresInDays: Number(days) })
      // Deliberately not in SWR/localStorage: only this mounted dialog holds
      // the once-only plaintext credential. Account changes unmount the tree.
      setIssued(result.data)
      await refresh()
    } catch { setError(text('requestFailed')) } finally { setBusy(false) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(config); setCopied(true); setError('') }
    catch { setError(text('copyFailed')) }
  }
  return <Modal title={text(issued ? 'configuration' : 'issue')} close={() => { if (!busy) close() }}>
    {issued ? <div className={styles['form']}>
      <p className={styles['form-note']}>{text('once')}</p>
      {!mcpUrl && <p className={styles['error']}>{text('missingUrl')}</p>}
      <label className={styles['field']}>{text('configuration')}<textarea className={local['secret-config']} readOnly spellCheck={false} autoComplete="off" rows={5} value={config} onFocus={event => event.target.select()} /></label>
      <div className={styles['form-actions']}><button type="button" className={styles['primary-button']} onClick={copy}><Copy size={15} />{text(copied ? 'copied' : 'copy')}</button><button type="button" className={styles['secondary-button']} onClick={close}>{t('close')}</button></div>
      {error && <p className={styles['error']} role="alert">{error}</p>}
    </div> : <form className={styles['form']} onSubmit={issue}>
      <label className={styles['field']}>{text('label')}<input required autoFocus maxLength={60} value={label} onChange={event => setLabel(event.target.value)} /></label>
      <label className={styles['field']}>{text('expiry')}<input required type="number" min={1} max={365} step={1} value={days} onChange={event => setDays(event.target.value)} /></label>
      <fieldset className={local['scope-list']}><legend>{text('permissions')}</legend>{scopes.map(scope => <label key={scope}>
        <input type="checkbox" checked={selected.includes(scope)} onChange={event => setSelected(current => event.target.checked ? [...current, scope] : current.filter(value => value !== scope))} />
        <span>{text(scopeLabels[scope as keyof typeof scopeLabels] || 'permissions')}<small>{scope}</small></span>
      </label>)}</fieldset>
      {error && <p className={styles['error']} role="alert">{error}</p>}
      <div><button className={styles['primary-button']} disabled={busy || !selected.length || !label.trim()}><KeyRound size={15} />{busy ? t('saving') : text('issue')}</button></div>
    </form>}
  </Modal>
}

function RevokeCredential({ credential, close, refresh }: { credential: BinesCredential; close: () => void; refresh: Refresh }) {
  const { locale, t, notify } = useBlog()
  const text = binesText(locale)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function revoke() {
    if (busy) return
    setBusy(true); setError('')
    try {
      await request(`/api/bines/admin/credentials/${credential.id}`, { method: 'DELETE' })
      await refresh(); notify(text('revoked')); close()
    } catch { setError(text('requestFailed')) } finally { setBusy(false) }
  }
  return <Modal title={text('revoke')} variant="confirm" close={() => { if (!busy) close() }}>
    <div className={styles['confirm-content']}><div className={styles['confirm-entry']}><ShieldOff size={24} /><strong>{credential.label}</strong></div><p>{text('revokeHint')}</p>{error && <p className={styles['error']} role="alert">{error}</p>}</div>
    <div className={styles['dialog-footer']}><button autoFocus type="button" className={styles['secondary-button']} disabled={busy} onClick={close}>{t('cancel')}</button><button type="button" className={styles['danger-button']} disabled={busy} onClick={revoke}>{busy ? t('saving') : text('revoke')}</button></div>
  </Modal>
}

export default function BinesAccess({ uid, refreshProfile }: { uid: string; refreshProfile: Refresh }) {
  const { locale, t } = useBlog()
  const text = binesText(locale)
  const { data, error, isLoading, mutate } = useSWR<Envelope<BinesAdmin>>(`/api/bines/admin?account=${encodeURIComponent(uid)}`, request, { refreshInterval: 30_000 })
  const [editing, setEditing] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [revoking, setRevoking] = useState<BinesCredential | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(interval)
  }, [])
  const admin = data?.data
  async function refresh() { await Promise.all([mutate(), refreshProfile()]) }
  return <section className={local['access-section']} aria-label={text('manage')}>
    <div className={styles['section-heading']}><div><div className={styles['eyebrow']}>BINES / ACCESS</div><h2>{text('manage')}</h2></div></div>
    <State loading={isLoading} error={error ? new Error(text('requestFailed')) : undefined} retry={() => mutate()} />
    {admin && <>
      <div className={local['account-row']}><div><h3>{text('profile')}</h3><p>{admin.profile ? `${admin.profile.displayName} · ${admin.profile.uid}` : text('manageHint')}</p></div><button className={styles['secondary-button']} onClick={() => setEditing(true)}><Pencil size={15} />{admin.profile ? t('edit') : text('setup')}</button></div>
      {admin.profile && <>
        <div className={local['list-heading']}><h3>{text('credentials')}</h3><button className={styles['secondary-button']} onClick={() => setIssuing(true)}><Plus size={15} />{text('issue')}</button></div>
        {!admin.mcpUrl && <p className={local['notice']}>{text('missingUrl')}</p>}
        {!admin.cacheNotificationsConfigured && <p className={local['notice']}>{text('cachePending')}</p>}
        {!admin.credentials.length && <p className={local['empty-note']}>{text('noCredentials')}</p>}
        <ul className={local['credential-list']}>{admin.credentials.map(credential => {
          const expired = Date.parse(credential.expiresAt) <= now
          const status = credential.revokedAt ? 'revoked' : expired ? 'expired' : 'active'
          return <li key={credential.id}>
            <div className={local['credential-title']}><strong>{credential.label}</strong><span data-active={status === 'active'}>{text(status)}</span><code>{credential.prefix}…</code></div>
            <div className={local['credential-details']}><div className={styles['tags']}>{credential.scopes.map(scope => <span key={scope}>{text(scopeLabels[scope as keyof typeof scopeLabels] || 'permissions')}</span>)}</div><p>{text('expires')} · {dateLabel(credential.expiresAt, locale)}<br />{text('lastUsed')} · {credential.lastUsedAt ? dateLabel(credential.lastUsedAt, locale) : text('never')}</p></div>
            {!credential.revokedAt && <button type="button" className={styles['secondary-button']} onClick={() => setRevoking(credential)} aria-label={`${text('revoke')} ${credential.label}`}><ShieldOff size={15} />{text('revoke')}</button>}
          </li>
        })}</ul>
      </>}
      <div className={local['list-heading']}><h3>{text('activity')}</h3><button type="button" className={styles['text-link']} onClick={() => mutate()}>{t('retry')}</button></div>
      {!admin.activity.length && <p className={local['empty-note']}>{text('noActivity')}</p>}
      <ol className={local['activity-list']}>{admin.activity.map(entry => <li key={entry.id}>
        <time dateTime={entry.createdAt}>{dateLabel(entry.createdAt, locale)}</time>
        <div><code>{entry.tool}</code>{entry.code && <small>{entry.code}</small>}{entry.target && /^\/(?:moments\/[a-f0-9]{24}|chat)$/.test(entry.target) && <Link className={styles['text-link']} href={entry.target}>{t('preview')} ↗</Link>}</div>
        <span data-error={entry.outcome === 'error'}>{text(entry.outcome)}</span>
      </li>)}</ol>
      {editing && <ProfileEditor profile={admin.profile} close={() => setEditing(false)} refresh={refresh} />}
      {issuing && <IssueCredential scopes={admin.scopes} mcpUrl={admin.mcpUrl} close={() => setIssuing(false)} refresh={refresh} />}
      {revoking && <RevokeCredential credential={revoking} close={() => setRevoking(null)} refresh={refresh} />}
    </>}
  </section>
}
