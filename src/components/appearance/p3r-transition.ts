export const P3R_WIPE_EVENT = 'ark:p3r-wipe'

export interface P3RWipeRequest {
  x: number
  y: number
  // Return false when the caller cancels navigation.
  navigate?: () => boolean
}

// No persisted state or router interception: only a mounted, capable renderer
// can accept a request. Otherwise Next's native Link behavior runs immediately.
export function requestP3RWipe(request: P3RWipeRequest) {
  const event = new CustomEvent<P3RWipeRequest>(P3R_WIPE_EVENT, { detail: request, cancelable: true })
  document.dispatchEvent(event)
  return event.defaultPrevented
}
