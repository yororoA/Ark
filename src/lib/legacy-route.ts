// Old links remain valid without rewriting database IDs or content.
export type LegacyQuery = Record<string, string | string[] | undefined>
export function legacySearchParams(values: LegacyQuery) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item)
  }
  return query
}

export function legacyDestination(path: string, params: URLSearchParams) {
  const normalized = path.replace(/\/+$/, '') || '/'
  const target = new URLSearchParams(params)
  const aliases: Record<string, string> = {
    '/town': '/home', '/town/home': '/home', '/town/articles': '/articles',
    '/town/moments': '/moments', '/town/gallery': '/gallery', '/town/archive': '/archive',
    '/town/other': '/about', '/town/lol': '/lab', '/town/chat': '/chat',
    '/account': '/login', '/account/login': '/login', '/account/register': '/login',
    '/account/town-law': '/terms', '/town/chat/group': '/chat', '/town/chat/private': '/chat',
    '/articles': '/articles', '/moments': '/moments',
  }
  let destination = aliases[normalized]
  if (!destination) return null
  if (normalized === '/account/login') target.set('mode', 'login')
  if (normalized === '/account/register') target.set('mode', 'register')
  if (normalized === '/town/chat/group') target.set('conversation', 'group')
  if (normalized === '/town/chat/private') target.set('legacyPrivate', '1')
  const idKey = destination === '/articles' ? 'kid' : destination === '/moments' ? 'mid' : null
  const id = idKey ? target.get(idKey) : null
  if (idKey && id && /^[a-f0-9]{24}$/.test(id)) {
    destination += `/${id}`
    target.delete(idKey)
  }
  return `${destination}${target.size ? `?${target}` : ''}`
}
