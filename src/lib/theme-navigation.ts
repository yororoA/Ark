const RETURN_ORIGIN = 'https://ark.invalid'
const RETURN_PAGES = new Set([
  '/home', '/articles', '/moments', '/gallery', '/archive', '/about',
  '/lab', '/chat', '/terms', '/notice', '/login',
  '/articles/new', '/moments/new',
])

/** Keep theme returns on known application pages, including their nested query. */
export function safeThemeReturn(value: string | null): string {
  if (!value?.startsWith('/') || value.startsWith('//')) return '/home'
  if ([...value].some(character => character === '\\' || character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return '/home'

  try {
    const url = new URL(value, RETURN_ORIGIN)
    const path = url.pathname.replace(/\/+$/, '') || '/home'
    const isDetail = /^\/(articles|moments)\/[a-f0-9]{24}$/.test(path)
    const isEditor = /^\/articles\/[a-f0-9]{24}\/edit$/.test(path)
    if (url.origin !== RETURN_ORIGIN || (!RETURN_PAGES.has(path) && !isDetail && !isEditor)) return '/home'
    return `${path}${url.search}${url.hash}`
  } catch {
    return '/home'
  }
}
