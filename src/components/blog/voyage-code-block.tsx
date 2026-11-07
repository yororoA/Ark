'use client'

import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react'
import type { ExtraProps } from 'react-markdown'
import { Check, Copy, RotateCcw } from 'lucide-react'
import { useAppearance } from '@/components/appearance/appearance-store'
import { useBlog } from './blog-provider'
import styles from './voyage-code-block.module.scss'

type PreProps = ComponentPropsWithoutRef<'pre'>
type CopyState = 'idle' | 'pending' | 'copied' | 'failed'
const COPY = {
  zh: { copy: '复制', copyLabel: '复制代码', pending: '复制中', copied: '已复制', retry: '重试复制', failed: '复制失败，可选中文字手动复制。', success: '代码已复制。', empty: '空代码', block: '代码块' },
  en: { copy: 'Copy', copyLabel: 'Copy code', pending: 'Copying', copied: 'Copied', retry: 'Retry copy', failed: 'Copy failed. You can select the code and copy it manually.', success: 'Code copied.', empty: 'Empty code', block: 'Code block' },
  ja: { copy: 'コピー', copyLabel: 'コードをコピー', pending: 'コピー中', copied: 'コピー済み', retry: '再試行', failed: 'コピーできませんでした。コードを選択して手動でコピーできます。', success: 'コードをコピーしました。', empty: '空のコード', block: 'コードブロック' },
  de: { copy: 'Kopieren', copyLabel: 'Code kopieren', pending: 'Wird kopiert', copied: 'Kopiert', retry: 'Erneut kopieren', failed: 'Kopieren fehlgeschlagen. Du kannst den Code markieren und manuell kopieren.', success: 'Code kopiert.', empty: 'Leerer Code', block: 'Codeblock' },
}

function ActiveCodeBlock({ language, text, children, className, ...props }: PreProps & { language: string; text: string }) {
  const { locale } = useBlog()
  const copy = COPY[locale]
  const pre = useRef<HTMLPreElement>(null)
  const mounted = useRef(true)
  const [feedback, setFeedback] = useState<{ source: string; status: CopyState }>({ source: text, status: 'idle' })
  const status = feedback.source === text ? feedback.status : 'idle'
  const empty = text.length === 0
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  async function copyCode() {
    if (empty || status === 'pending') return
    // Read only the code node: keep all original indentation, blank lines and
    // the rendered final newline without copying the controls or language.
    const value = pre.current?.querySelector('code')?.textContent ?? text
    setFeedback({ source: text, status: 'pending' })
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      if (mounted.current) setFeedback({ source: text, status: 'copied' })
    } catch {
      if (mounted.current) setFeedback({ source: text, status: 'failed' })
    }
  }

  return <div className={styles.block} data-voyage-code data-testid="voyage-code-block">
    <div className={styles.header}>
      {language && <span className={styles.language} data-testid="voyage-code-language">{language}</span>}
      <button type="button" className={styles.copy} onClick={copyCode} disabled={empty || status === 'pending'} aria-label={empty ? copy.empty : status === 'failed' ? copy.retry : copy.copyLabel} aria-busy={status === 'pending'}>
        {status === 'copied' ? <Check size={14} aria-hidden="true" /> : status === 'failed' ? <RotateCcw size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        <span>{empty ? copy.empty : status === 'pending' ? copy.pending : status === 'copied' ? copy.copied : status === 'failed' ? copy.retry : copy.copy}</span>
      </button>
    </div>
    <pre {...props} ref={pre} className={`${styles.pre}${className ? ` ${className}` : ''}`} tabIndex={0} aria-label={language ? `${copy.block} · ${language}` : copy.block}>{children}</pre>
    <span className={status === 'failed' ? styles.failure : styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{status === 'failed' ? copy.failed : status === 'copied' ? copy.success : ''}</span>
  </div>
}

export default function VoyageCodeBlock({ node, ...props }: PreProps & ExtraProps) {
  const { design } = useAppearance()
  if (design !== 'voyage') return <pre {...props} />
  const code = node?.children.find(child => child.type === 'element' && child.tagName === 'code')
  const classNames = code?.type === 'element' ? code.properties.className : undefined
  const languageClass = (Array.isArray(classNames) ? classNames : [classNames]).find(value => typeof value === 'string' && value.startsWith('language-'))
  const language = typeof languageClass === 'string' ? languageClass.slice('language-'.length) : ''
  const text = code?.type === 'element' ? code.children.filter(child => child.type === 'text').map(child => child.value).join('') : ''
  return <ActiveCodeBlock {...props} language={language} text={text} />
}
