export const P3R_WIPE_EVENT = 'ark:p3r-wipe'

export interface P3RWipeRequest {
  x: number
  y: number
  // Runs once the wipe covers the page. Return false when the caller cancels.
  navigate?: () => boolean
  // Fall back to native navigation if the client router never commits.
  fallback?: () => void
}

// No persisted state or router interception: only a mounted, capable renderer
// can accept a request. Otherwise Next's native Link behavior runs immediately.
export function requestP3RWipe(request: P3RWipeRequest) {
  const event = new CustomEvent<P3RWipeRequest>(P3R_WIPE_EVENT, { detail: request, cancelable: true })
  document.dispatchEvent(event)
  return event.defaultPrevented
}

let covering = false
// True only while a route hands off beneath a complete cover, so callers such
// as the menu can leave instantly instead of animating out of sight.
export const isP3RWipeCovering = () => covering
export function handOffUnderP3RWipe<T>(handoff: () => T) {
  covering = true
  try { return handoff() } finally { covering = false }
}
