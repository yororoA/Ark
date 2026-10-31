/** Share a canonical content URL, without list filters or navigation state. */
export async function shareContent(title: string): Promise<'shared' | 'copied' | 'cancelled' | string> {
  const url = new URL(location.pathname, location.origin).href
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
      return 'shared'
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled'
      // Unsupported or denied sharing can still offer a copyable link.
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return url
  }
}
