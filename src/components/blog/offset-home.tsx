'use client'
/* eslint-disable @next/next/no-img-element -- Covers come from existing article content. */

import type { CSSProperties, ReactNode } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react'
import Link from '@/components/appearance/p3r-link'
import { articlePreview, dateLabel, excerpt, translate, type Entry, type Locale } from '@/lib/blog'
import styles from './offset-home.module.scss'

const COPY = {
  zh: { name: '错版', title: ['把日常，', '重新排版。'], intro: '一些文字，一些片刻。\n在既定的格子之外，留下自己的形状。', read: '进入文字', moments: '翻看片刻', connect: '来聊聊', writings: '文字，正在发生。', fragments: '小事，也有分量。', all: '全部文章', allMoments: '全部片刻', note: '不必整齐划一。', end: ['生活没有标准版式。', '下一页，继续。'], about: '关于这座 Ark', scroll: '向下翻阅', colophon: '个人档案 / 持续增订中' },
  en: { name: 'Offset', title: ['Every day.', 'Set differently.'], intro: 'A few words. A few moments.\nRoom for a shape of our own.', read: 'Read the journal', moments: 'Browse moments', connect: 'Say hello', writings: 'Words, in progress.', fragments: 'Small things. Real weight.', all: 'All writings', allMoments: 'All moments', note: 'No two impressions alike.', end: ['Life has no fixed layout.', 'On to the next page.'], about: 'About this Ark', scroll: 'Keep reading', colophon: 'PERSONAL ARCHIVE / ALWAYS IN PROGRESS' },
  ja: { name: '版ずれ', title: ['日々を、', '組み直す。'], intro: 'いくつかの言葉、いくつかの瞬間。\n枠の外に、自分だけのかたちを。', read: '言葉を読む', moments: '瞬間を見る', connect: '話そう', writings: '言葉は、まだ途中。', fragments: '小さなことにも、重み。', all: 'すべての文章', allMoments: 'すべての瞬間', note: '同じでなくていい。', end: ['暮らしに決まった版式はない。', '次のページへ。'], about: 'この Ark について', scroll: '下へ読み進める', colophon: '個人の記録 / 増補中' },
  de: { name: 'Offset', title: ['Jeder Tag.', 'Neu gesetzt.'], intro: 'Ein paar Worte. Ein paar Momente.\nPlatz für eine eigene Form.', read: 'Im Journal lesen', moments: 'Momente ansehen', connect: 'Hallo sagen', writings: 'Worte, im Werden.', fragments: 'Kleine Dinge. Echtes Gewicht.', all: 'Alle Texte', allMoments: 'Alle Momente', note: 'Kein Abdruck wie der andere.', end: ['Das Leben hat kein festes Layout.', 'Weiter zur nächsten Seite.'], about: 'Über diese Ark', scroll: 'Weiterlesen', colophon: 'PERSÖNLICHES ARCHIV / IM WERDEN' },
}

// Each complete word reads across; the shared accent column reads OFFSET down.
const IMPRESSIONS = [
  ['N', 'O', 'TES'], ['', 'F', 'RAGMENTS'], ['RE', 'F', 'LECTIONS'],
  ['IMPRES', 'S', 'IONS'], ['D', 'E', 'TAILS'], ['S', 'T', 'ORIES'],
] as const

function MotionPrint() {
  return <div className={styles.motionPrint} aria-hidden="true">
    <div className={styles.printTop}><span>FIG. 08 / OPEN FORM</span><span>↗</span></div>
    <div className={styles.printField}>
      <div className={styles.printFrame} /><div className={styles.printFrame} /><div className={styles.printFrame} />
      <div className={styles.printTiles}>{Array.from({ length: 9 }, (_, index) => <i key={index} style={{ '--tile': index } as CSSProperties} />)}</div>
      <span className={styles.printOrbit}>+</span><span className={styles.printLetter}>a<span>↗</span></span>
    </div>
    <div className={styles.printBottom}><span>ROOM TO<br />BECOME.</span><span>形状未定，故事继续。</span></div>
  </div>
}

export default function OffsetHome({ locale, articles, moments, articleState, momentState, activity }: {
  locale: Locale; articles: Entry[]; moments: Entry[]; articleState: ReactNode; momentState: ReactNode; activity?: ReactNode
}) {
  const copy = COPY[locale]
  const featured = articles[0]
  const preview = featured ? articlePreview(featured.content) : null
  return <div className={styles.home} data-testid="offset-home" lang={locale}>
    <section className={styles.poster} aria-labelledby="offset-title">
      <div className={styles.masthead}><span>YOROROICE / NOTES IN MOTION</span><span>EDITION 08 <i /> {copy.name}</span></div>
      <div className={styles.hero}>
        <div className={styles.typeblock}>
          <span className={styles.vertical}>A PERSONAL IMPRESSION — 2026</span>
          <h1 id="offset-title" aria-label={`OFFSET / ${copy.name}`}>
            <span className={styles.typeRow}><span data-ink="OFF">OFF</span></span>
            <span className={styles.typeRow}><span data-ink="SET.">SET.</span></span>
          </h1>
          <div className={styles.registration} aria-hidden="true"><i /><span>R / K</span><i /></div>
          <div className={styles.typeAnnotation} aria-hidden="true"><i /><span>A LITTLE<br />OUT OF LINE.</span><b>↗</b></div>
          <p className={styles.typeNote}><span>WORDS HAVE SHAPE.</span><span>SO DOES A LIFE.</span></p>
        </div>
        <div className={styles.copy}>
          <div className={styles.edition} aria-hidden="true"><span>08 / PERSONAL EDITION</span><i /><i /><i /></div>
          <h2>{copy.title.map(line => <span key={line}>{line}</span>)}</h2>
          <p>{copy.intro}</p>
          <nav className={styles.index} aria-label={translate(locale, 'contents')}>
            {([['/articles', copy.read, '01'], ['/moments', copy.moments, '02'], ['/chat', copy.connect, '03']] as const).map(([href, label, number]) => <Link href={href} key={href}><span>{number}</span><strong>{label}</strong><ArrowUpRight size={23} /></Link>)}
          </nav>
        </div>
      </div>
      <div className={styles.composition}>
        <MotionPrint />
        <div className={styles.typePoem} aria-hidden="true">
          <div className={styles.poemCaption}><span>THE THINGS WE KEEP</span><span>01 — 06</span></div>
          <div className={styles.poemWords}>{IMPRESSIONS.map(([before, letter, after], index) => <div key={after} style={{ '--word': index } as CSSProperties}><span>{before}</span><b>{letter}</b><span>{after}</span></div>)}</div>
          <div className={styles.poemFoot}><span>READ ACROSS. LOOK AGAIN.</span><ArrowDown size={16} /></div>
        </div>
      </div>
      <div className={styles.strip}><span>NOT EVERYTHING<br />HAS TO LINE UP.</span><strong>{copy.note}</strong><a href="#offset-writings">{copy.scroll}<ArrowDown size={22} /></a></div>
    </section>

    <section id="offset-writings" className={styles.writings}>
      <header className={styles.sectionHead}><div><span>01 / WRITTEN MATTER</span><h2>{copy.writings}</h2></div><Link href="/articles">{copy.all}<ArrowUpRight size={20} /></Link></header>
      {articleState}
      <div className={styles.articleGrid}>
        {featured && preview && <Link href={`/articles/${featured._id}`} className={styles.featured}>
          <div className={styles.featuredImage}>
            {preview.coverUrl ? <img src={preview.coverUrl} alt={preview.coverAlt || ''} loading="lazy" /> : <div className={styles.emptyCover} aria-hidden="true">TYPE<br /><span>MATTERS.</span></div>}
            <span className={styles.imageIndex}>SELECTED / 01</span><ArrowUpRight className={styles.imageArrow} size={40} />
          </div>
          <div className={styles.meta}><span>{featured.category || translate(locale, 'articles')}</span><time>{dateLabel(featured.createdAt, locale)}</time></div>
          <h3>{featured.title}</h3><p>{excerpt(preview.content, 115)}</p>
        </Link>}
        <div className={styles.notes}>
          <div className={styles.wordmark} aria-hidden="true"><span>NO</span><span>SMALL</span><span>THINGS<span className={styles.dot}>.</span></span><i>EVERY DETAIL LEAVES A MARK.</i><div className={styles.wordTiles}><b /><b /><b /><b /></div></div>
          {articles.slice(1, 4).map((entry, index) => <Link key={entry._id} href={`/articles/${entry._id}`} className={styles.note}><span>0{index + 2}</span><div><time>{dateLabel(entry.createdAt, locale)}</time><h3>{entry.title}</h3></div><ArrowUpRight size={20} /></Link>)}
          <Link href="/archive" className={styles.archiveLink}>{translate(locale, 'archive')}<ArrowRight size={22} /></Link>
        </div>
      </div>
    </section>

    <section className={styles.fragments}>
      <header className={styles.sectionHead}><div><span>02 / UNBOUND NOTES</span><h2>{copy.fragments}</h2></div><Link href="/moments">{copy.allMoments}<ArrowUpRight size={20} /></Link></header>
      {momentState}
      <div className={styles.momentList}>{moments.slice(0, 3).map((entry, index) => <Link key={entry._id} href={`/moments/${entry._id}`} className={styles.moment}>
        <div className={styles.momentTop}><span>0{index + 1}</span><ArrowUpRight size={27} /></div><time>{dateLabel(entry.createdAt, locale)}</time><h3>{entry.title}</h3><p>{excerpt(articlePreview(entry.content).content, 80)}</p><span className={styles.momentFoot}>A MOMENT / AN IMPRESSION</span>
      </Link>)}</div>
    </section>
    {activity}
    <section className={styles.colophon}><div><span>{copy.colophon}</span><h2>{copy.end.map(line => <span key={line}>{line}</span>)}</h2><Link href="/about">{copy.about}<ArrowUpRight size={23} /></Link></div><div className={styles.endMark} aria-hidden="true"><span>A</span><span>R</span><span>K</span><i>KEEP<br />MAKING<br />MARKS.</i></div></section>
  </div>
}
