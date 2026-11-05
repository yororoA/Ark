'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { PROFILE, type Locale } from '@/lib/blog'
import styles from './home-code-activity.module.scss'

type HomeCodeActivityProps = {
  locale: Locale
  summary?: { reposCount: number; monthCommits: number; languages: { name: string; percent: number }[] }
  state: ReactNode
  design: 'allotype' | 'fold' | 'voyage'
}

const COPY = {
  zh: { title: '另一种写作。', period: '近 30 天', commits: '次代码提交', repositories: '个仓库', languages: '代码语言', scale: '完整轨道 = 全部语言的 100%', noLanguages: '尚无语言统计', profile: '在 GitHub 继续阅读', source: '代码活动' },
  en: { title: 'Written in code.', period: 'Last 30 days', commits: 'commits', repositories: 'repositories', languages: 'Languages', scale: 'Full track = all languages (100%)', noLanguages: 'No language statistics yet', profile: 'Continue on GitHub', source: 'Code activity' },
  ja: { title: 'コードで、書きつづける。', period: '過去 30 日間', commits: '回のコミット', repositories: 'リポジトリ', languages: 'コードの言語', scale: 'バー全体 = 全言語の合計 (100%)', noLanguages: '言語の統計はまだありません', profile: 'GitHub で続きを読む', source: 'コードの記録' },
  de: { title: 'In Code geschrieben.', period: 'Letzte 30 Tage', commits: 'Commits', repositories: 'Repositorys', languages: 'Programmiersprachen', scale: 'Voller Balken = alle Sprachen (100 %)', noLanguages: 'Noch keine Sprachstatistik', profile: 'Auf GitHub weiterlesen', source: 'Code-Aktivität' },
}

export default function HomeCodeActivity({ locale, summary, state, design }: HomeCodeActivityProps) {
  const ref = useRef<HTMLElement>(null)
  const copy = COPY[locale]
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 })
  const languages = summary?.languages.filter(language => language.name.trim() && Number.isFinite(language.percent) && language.percent >= 0 && language.percent <= 100).slice(0, 4) ?? []
  const count = (value: number) => Number.isFinite(value) && value >= 0 ? number.format(value) : '—'
  const percent = (value: number) => `${value > 0 && value < .01 ? `<${number.format(.01)}` : number.format(value)}%`

  useEffect(() => {
    const section = ref.current
    if (!section || !('IntersectionObserver' in window)) return
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) return
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      section.dataset.enter = 'visible'
      observer.disconnect()
    }, { threshold: .12 })
    section.dataset.enter = 'waiting'
    observer.observe(section)
    const reduce = () => {
      if (!reducedMotion.matches) return
      observer.disconnect()
      delete section.dataset.enter
    }
    reducedMotion.addEventListener('change', reduce)
    return () => {
      observer.disconnect()
      reducedMotion.removeEventListener('change', reduce)
      delete section.dataset.enter
    }
  }, [])

  return <section ref={ref} className={styles.activity} data-design={design} data-testid="activity-github" aria-label={copy.source}>
    <header className={styles.header}>
      <div className={styles.title}><span className={styles.eyebrow}>GITHUB / {copy.source}</span><h2>{copy.title}</h2></div>
      <a className={styles.profile} href={PROFILE.github} target="_blank" rel="noreferrer"><span>{copy.profile}</span><ArrowUpRight size={20} aria-hidden="true" /></a>
    </header>
    {summary && <div className={styles.log}>
      <div className={styles.commits}>
        <span className={styles.period}>{copy.period}</span>
        <strong className={styles.commitValue} data-testid="code-commits">{count(summary.monthCommits)}</strong>
        <span className={styles.metricLabel}>{copy.commits}</span>
      </div>
      <div className={styles.repositories}>
        <span className={styles.metricIndex} aria-hidden="true">/ REPOSITORIES</span>
        <strong className={styles.repositoryValue} data-testid="code-repositories">{count(summary.reposCount)}</strong>
        <span className={styles.metricLabel}>{copy.repositories}</span>
      </div>
      <div className={styles.languages}>
        <div className={styles.languageHeading}><h3>{copy.languages}</h3><span aria-hidden="true">100%</span></div>
        {languages.length ? <ul className={styles.languageList}>{languages.map((language, index) => <li className={styles.language} key={`${language.name}-${index}`}>
          <div className={styles.languageText}><span className={styles.languageName}>{language.name}</span><span className={styles.languagePercent}>{percent(language.percent)}</span></div>
          <div className={styles.languageTrack} aria-hidden="true"><span style={{ width: `${language.percent}%` }} /></div>
        </li>)}</ul> : <p className={styles.empty}>{copy.noLanguages}</p>}
        {languages.length > 0 && <p className={styles.scale}>{copy.scale}</p>}
      </div>
    </div>}
    <div className={styles.state}>{state}</div>
  </section>
}
