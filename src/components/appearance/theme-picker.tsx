'use client'

import { useCallback, useId, useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { Check, Monitor, Moon, Palette, Sun, X } from 'lucide-react'
import { COLOR_MODES, DESIGNS } from '@/lib/appearance'
import type { Locale } from '@/lib/blog'
import { useAppearance } from './appearance-store'
import styles from './theme-picker.module.scss'

const COPY = {
  zh: { title: '外观', design: '视觉主题', mode: '明暗模式', archive: '档案', rain: '雨声', archiveNote: '纸白 · 朱红 · 轨道', rainNote: '水青 · 细雨 · 留白', light: '浅色', dark: '深色', system: '跟随系统', close: '关闭外观设置', note: '让文字，留在喜欢的风景里。' },
  en: { title: 'Appearance', design: 'Visual theme', mode: 'Color mode', archive: 'Archive', rain: 'Rain', archiveNote: 'Paper · Vermilion · Orbits', rainNote: 'Aqua · Rain · Stillness', light: 'Light', dark: 'Dark', system: 'System', close: 'Close appearance settings', note: 'A different atmosphere for the same stories.' },
  ja: { title: '外観', design: 'テーマ', mode: 'カラーモード', archive: '記録', rain: '雨音', archiveNote: '紙白・朱色・軌道', rainNote: '水青・小雨・余白', light: 'ライト', dark: 'ダーク', system: 'システム', close: '外観設定を閉じる', note: '好きな景色に、言葉を残す。' },
  de: { title: 'Darstellung', design: 'Visuelles Thema', mode: 'Farbmodus', archive: 'Archiv', rain: 'Regen', archiveNote: 'Papier · Zinnober · Orbits', rainNote: 'Aqua · Regen · Ruhe', light: 'Hell', dark: 'Dunkel', system: 'System', close: 'Darstellung schließen', note: 'Eine andere Atmosphäre für dieselben Geschichten.' },
}
const MODE_ICONS = { light: Sun, dark: Moon, system: Monitor }

export default function ThemePicker({ locale = 'zh' }: { locale?: Locale }) {
  const { design, colorMode, setDesign, setColorMode } = useAppearance()
  const copy = COPY[locale]
  const id = useId()
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const triggerRef = useCallback((node: HTMLButtonElement | null) => {
    // Account management and native dialogs must keep popups in their layer.
    if (node) setContainer(node.closest<HTMLElement>('dialog, [role="dialog"]'))
  }, [])
  return <Popover.Root>
    <Popover.Trigger ref={triggerRef} className={styles['theme-trigger']} aria-label={copy.title} title={copy.title}>
      <Palette size={18} strokeWidth={1.4} />
    </Popover.Trigger>
    <Popover.Portal container={container ?? undefined}>
      <Popover.Positioner className={styles['theme-positioner']} positionMethod="fixed" align="end" sideOffset={12} collisionPadding={12}>
        <Popover.Popup className={styles['theme-panel']}>
          <div className={styles['panel-heading']}>
            <Popover.Title className={styles['panel-title']}>{copy.title}<span aria-hidden="true"> / APPEARANCE</span></Popover.Title>
            <Popover.Close className={styles['close-button']} aria-label={copy.close}><X size={17} strokeWidth={1.4} /></Popover.Close>
          </div>
          <fieldset className={styles['theme-field']}>
            <legend>{copy.design}</legend>
            <div className={styles['design-options']}>
              {DESIGNS.map(option => <label key={option} className={styles['design-option']}>
                <input type="radio" name={`${id}-design`} value={option} checked={design === option} onChange={() => setDesign(option)} />
                <span className={styles['design-preview']} data-preview={option} aria-hidden="true">
                  <span className={styles['preview-type']}>Aa<span>雨</span></span>
                  <span className={styles['preview-art']}><i /><i /><i /></span>
                  <span className={styles['preview-line']} />
                </span>
                <span className={styles['option-label']}>{copy[option]}<Check size={13} aria-hidden="true" /></span>
                <span className={styles['option-note']}>{copy[option === 'archive' ? 'archiveNote' : 'rainNote']}</span>
              </label>)}
            </div>
          </fieldset>
          <fieldset className={styles['theme-field']}>
            <legend>{copy.mode}</legend>
            <div className={styles['mode-options']}>
              {COLOR_MODES.map(mode => {
                const Icon = MODE_ICONS[mode]
                return <label key={mode} className={styles['mode-option']}>
                  <input type="radio" name={`${id}-mode`} value={mode} checked={colorMode === mode} onChange={() => setColorMode(mode)} />
                  <span><Icon size={15} strokeWidth={1.4} />{copy[mode]}</span>
                </label>
              })}
            </div>
          </fieldset>
          <Popover.Description className={styles['panel-note']}>{copy.note}</Popover.Description>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
}
