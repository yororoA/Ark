'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Select } from '@base-ui/react/select'
import { Popover } from '@base-ui/react/popover'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useBlog } from './blog-provider'
import styles from './blog.module.scss'

type Choice = { value: string; label: string }

// Keep portals in the current theme and, inside a native dialog, its top layer.
function useOverlayContainer() {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const triggerRef = useCallback((node: HTMLButtonElement | null) => {
    if (node) setContainer(node.closest<HTMLElement>('dialog, [data-blog-root]'))
  }, [])
  return { container, triggerRef }
}

export function BlogSelect({ label, value, options, onChange, compact = false, hideLabel = false, displayValue }: {
  label: string
  value: string
  options: Choice[]
  onChange: (value: string) => void
  compact?: boolean
  hideLabel?: boolean
  displayValue?: string
}) {
  const id = useId()
  const { container, triggerRef } = useOverlayContainer()
  return (
    <div className={styles['control-field']} data-compact={compact} data-quiet={hideLabel}>
      <label htmlFor={id} className={hideLabel ? styles['sr-only'] : styles['control-label']}>{label}</label>
      <Select.Root value={value} items={options} onValueChange={next => { if (next !== null) onChange(next) }} modal={false}>
        <Select.Trigger id={id} ref={triggerRef} className={styles['select-trigger']} aria-label={label}>
          <span className={styles['select-value']}>{displayValue || options.find(option => option.value === value)?.label || value}</span>
          <Select.Icon className={styles['select-chevron']}><ChevronDown size={13} /></Select.Icon>
        </Select.Trigger>
        <Select.Portal container={container}>
          <Select.Positioner className={styles['control-positioner']} alignItemWithTrigger={false} positionMethod="fixed" sideOffset={8} collisionPadding={12}>
            <Select.Popup className={styles['select-popup']} data-blog-control-popup>
              <div className={styles['control-caption']} aria-hidden="true">{label}</div>
              <Select.List className={styles['select-list']}>
                {options.map((option, index) => (
                  <Select.Item key={option.value} value={option.value} className={styles['select-option']}>
                    <span className={styles['option-index']} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <Select.ItemText>{option.label}</Select.ItemText>
                    <Select.ItemIndicator className={styles['option-check']}><Check size={14} /></Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.List>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </div>
  )
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function readDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date()
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return dateKey(date) === value ? date : new Date()
}

function moveMonth(date: Date, offset: number) {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + offset + 1, 0).getDate()
  return new Date(date.getFullYear(), date.getMonth() + offset, Math.min(date.getDate(), lastDay))
}

function DateCalendar({ value, choose }: { value: string; choose: (value: string) => void }) {
  const { locale, t } = useBlog()
  const [focusedDate, setFocusedDate] = useState(() => readDate(value))
  const [month, setMonth] = useState(() => readDate(value))
  const focusedRef = useRef<HTMLButtonElement>(null)
  const moveFocus = useRef(false)
  const monthId = useId()
  const dateLocale = { zh: 'zh-CN', en: 'en-GB', ja: 'ja-JP', de: 'de-DE' }[locale]
  const monthLabel = month.toLocaleDateString(dateLocale, { year: 'numeric', month: 'long' })
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const days = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1))
  const weekdays = Array.from({ length: 7 }, (_, index) => new Date(2024, 0, index + 1).toLocaleDateString(dateLocale, { weekday: 'short' }))
  const today = dateKey(new Date())

  useEffect(() => {
    if (moveFocus.current) {
      focusedRef.current?.focus()
      moveFocus.current = false
    }
  }, [focusedDate])

  function navigate(event: React.KeyboardEvent, date: Date) {
    let next: Date
    const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (event.key in offsets) next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsets[event.key])
    else if (event.key === 'Home') next = new Date(date.getFullYear(), date.getMonth(), date.getDate() - (date.getDay() + 6) % 7)
    else if (event.key === 'End') next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 6 - (date.getDay() + 6) % 7)
    else if (event.key === 'PageUp' || event.key === 'PageDown') next = moveMonth(date, (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1))
    else return
    event.preventDefault()
    moveFocus.current = true
    setFocusedDate(next)
    setMonth(next)
  }

  function changeMonth(offset: number) {
    const next = moveMonth(month, offset)
    setMonth(next)
    setFocusedDate(next)
  }

  return (
    <div className={styles['date-calendar']}>
      <div className={styles['calendar-heading']}>
        <button type="button" className={styles['icon-button']} aria-label={t('previousMonth')} onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button>
        <Popover.Title id={monthId} className={styles['calendar-month']} aria-live="polite">{monthLabel}</Popover.Title>
        <button type="button" className={styles['icon-button']} aria-label={t('nextMonth')} onClick={() => changeMonth(1)}><ChevronRight size={16} /></button>
      </div>
      <table role="grid" aria-labelledby={monthId} className={styles['date-grid']}>
        <thead><tr>{weekdays.map((day, index) => <th key={index} scope="col">{day}</th>)}</tr></thead>
        <tbody>{Array.from({ length: 6 }, (_, row) => (
          <tr key={row}>{days.slice(row * 7, row * 7 + 7).map(date => {
            const key = dateKey(date)
            const focused = key === dateKey(focusedDate)
            return (
              <td key={key} role="gridcell" aria-selected={key === value}>
                <button
                  type="button"
                  ref={focused ? focusedRef : undefined}
                  tabIndex={focused ? 0 : -1}
                  className={styles['date-day']}
                  data-outside={date.getMonth() !== month.getMonth()}
                  data-selected={key === value}
                  aria-current={key === today ? 'date' : undefined}
                  aria-label={date.toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                  onKeyDown={event => navigate(event, date)}
                  onClick={() => choose(key)}
                >{date.getDate()}</button>
              </td>
            )
          })}</tr>
        ))}</tbody>
      </table>
      <div className={styles['calendar-footer']}>
        <button type="button" onClick={() => choose('')}>{t('reset')}</button>
        <span aria-hidden="true">/</span>
        <button type="button" onClick={() => choose(today)}>{t('today')}</button>
      </div>
    </div>
  )
}

export function DateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useBlog()
  const [open, setOpen] = useState(false)
  const { container, triggerRef } = useOverlayContainer()
  const id = useId()
  return (
    <div className={styles['control-field']} data-compact>
      <label htmlFor={id} className={styles['control-label']}>{t('date')}</label>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger id={id} ref={triggerRef} className={styles['date-trigger']} aria-label={`${t('date')}: ${value || t('allDates')}`}>
          <CalendarDays size={15} />
          <span>{value ? value.replaceAll('-', ' / ') : t('allDates')}</span>
          <ChevronDown size={13} />
        </Popover.Trigger>
        <Popover.Portal container={container}>
          <Popover.Positioner className={styles['control-positioner']} positionMethod="fixed" sideOffset={8} collisionPadding={12}>
            <Popover.Popup className={styles['calendar-popup']} data-blog-control-popup>
              {open && <DateCalendar value={value} choose={date => { onChange(date); setOpen(false) }} />}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
