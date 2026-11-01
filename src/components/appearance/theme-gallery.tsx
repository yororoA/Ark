'use client'

import { useId } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Check, CheckCircle2, Monitor, Moon, Sun } from 'lucide-react'
import { COLOR_MODES, DESIGNS } from '@/lib/appearance'
import { QINGJIAN_COPY } from '@/lib/qingjian-copy'
import { P3R_COPY } from '@/lib/p3r-copy'
import { PRISM_COPY } from '@/lib/prism-copy'
import { ALLOTYPE_COPY } from '@/lib/allotype'
import { safeThemeReturn } from '@/lib/theme-navigation'
import { useBlog } from '@/components/blog/blog-provider'
import { useAppearance } from './appearance-store'
import Link from './p3r-link'
import ThemePreview from './theme-preview'
import styles from './theme-gallery.module.scss'

const COPY = {
  zh: { title: '主题与外观', done: '继续浏览', back: '返回原页面', intro: '挑一种喜欢的风景，继续记录自己的故事。', design: '选择主题', mode: '明暗模式', current: '当前使用', apply: '切换主题', saved: '选择即时生效，并保存在此浏览器。', archive: '档案', archiveNote: '编号 · 索引 · 编辑排版', light: '浅色', dark: '深色', system: '跟随系统', end: '风景在变，故事继续。' },
  en: { title: 'Make it your own', done: 'Continue browsing', back: 'Back to previous page', intro: 'A different atmosphere for the same stories. Find the one that feels like you.', design: 'Choose a theme', mode: 'Color mode', current: 'In use', apply: 'Use theme', saved: 'Changes apply immediately and are saved in this browser.', archive: 'Archive', archiveNote: 'Indexed · Editorial', light: 'Light', dark: 'Dark', system: 'System', end: 'A new view. Your story continues.' },
  ja: { title: 'テーマと外観', done: '閲覧を続ける', back: '前のページに戻る', intro: '好きな景色を選んで、自分だけの物語を続けよう。', design: 'テーマを選ぶ', mode: 'カラーモード', current: '使用中', apply: 'このテーマにする', saved: '変更はすぐに反映され、このブラウザに保存されます。', archive: '記録', archiveNote: '番号・索引・誌面', light: 'ライト', dark: 'ダーク', system: 'システム', end: '景色が変わっても、物語は続く。' },
  de: { title: 'Dein Erscheinungsbild', done: 'Weiterlesen', back: 'Zur vorherigen Seite', intro: 'Eine neue Atmosphäre für dieselben Geschichten. Wähle, was zu dir passt.', design: 'Thema wählen', mode: 'Farbmodus', current: 'Aktiv', apply: 'Thema verwenden', saved: 'Änderungen gelten sofort und werden in diesem Browser gespeichert.', archive: 'Archiv', archiveNote: 'Index · Editorial', light: 'Hell', dark: 'Dunkel', system: 'System', end: 'Ein neuer Blick. Deine Geschichte geht weiter.' },
}
const MODE_ICONS = { light: Sun, dark: Moon, system: Monitor }

export default function ThemeGallery() {
  const { locale } = useBlog()
  const { design, colorMode, setDesign, setColorMode } = useAppearance()
  const params = useSearchParams()
  const returnTo = safeThemeReturn(params.get('returnTo'))
  const id = useId()
  const copy = COPY[locale]
  const themes = {
    archive: { name: copy.archive, description: copy.archiveNote },
    rain: QINGJIAN_COPY[locale], p3r: P3R_COPY[locale],
    prism: PRISM_COPY[locale], allotype: ALLOTYPE_COPY[locale],
  }

  return <div className={styles.page} data-testid="theme-page" lang={locale}>
    <div className={styles.topline}><Link href={returnTo}><ArrowLeft size={17} />{copy.back}</Link><span>ARK / PERSONAL APPEARANCE</span></div>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>A CHANGE OF SCENERY</p><h1>Theme<span>{copy.title}</span></h1></div>
      <p className={styles.intro}>{copy.intro}</p>
    </header>
    <div className={styles.settings}>
      <fieldset className={styles['mode-field']}>
        <legend>{copy.mode}</legend>
        <div className={styles['mode-options']}>{COLOR_MODES.map(mode => {
          const Icon = MODE_ICONS[mode]
          return <label key={mode}>
            <input type="radio" name={`${id}-mode`} value={mode} checked={colorMode === mode} aria-label={copy[mode]} onChange={() => setColorMode(mode)} />
            <span><Icon size={17} strokeWidth={1.5} />{copy[mode]}</span>
          </label>
        })}</div>
      </fieldset>
      <div className={styles['current-theme']}><span><CheckCircle2 size={16} /><span role="status">{copy.current} · {themes[design].name}</span></span><p>{copy.saved}</p></div>
    </div>
    <fieldset className={styles.catalog}>
      <legend><span>{copy.design}</span><span>01 — 05</span></legend>
      <div className={styles.grid}>{DESIGNS.map((option, index) => {
        const theme = themes[option]
        return <label key={option} className={styles.card} data-selected={design === option}>
          <input type="radio" name={`${id}-design`} value={option} checked={design === option} aria-label={theme.name}
            aria-describedby={`${id}-${option}-description`} onChange={() => setDesign(option)} />
          <div className={styles['card-art']}><ThemePreview design={option} /><span className={styles['selected-mark']}><Check size={17} /></span></div>
          <div className={styles['card-caption']}>
            <span className={styles.number}>0{index + 1}</span>
            <div className={styles['card-description']}><h2>{theme.name}</h2><p id={`${id}-${option}-description`}>{theme.description}</p></div>
            <span className={styles['card-action']}>{design === option ? copy.current : copy.apply}<span aria-hidden="true">{design === option ? '✓' : '↗'}</span></span>
          </div>
        </label>
      })}</div>
    </fieldset>
    <footer className={styles.bottom}><span>{copy.end}</span><Link href={returnTo}>{copy.done}<ArrowLeft size={16} /></Link></footer>
  </div>
}
