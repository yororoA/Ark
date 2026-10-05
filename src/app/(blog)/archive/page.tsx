import Archive from '@/components/blog/archive'
import { pageMetadata } from '@/lib/seo'
import { getArchivePage, getArchiveYears } from '@/lib/server/public-content'

export const metadata = pageMetadata({
  title: '归档',
  description: '按时间浏览 YororoIce Ark 的文章与片刻记录。',
  path: '/archive',
})

export default async function Page() {
  const [archive, years] = await Promise.allSettled([
    getArchivePage(),
    getArchiveYears(),
  ])

  return (
    <Archive
      initialData={archive.status === 'fulfilled' ? archive.value : undefined}
      initialYears={years.status === 'fulfilled' ? years.value : undefined}
    />
  )
}
