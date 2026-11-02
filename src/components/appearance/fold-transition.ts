export const FOLD_TRANSITION_EVENT = 'ark:fold-transition'

export interface FoldTransitionRequest {
  x: number
  y: number
  navigate?: () => boolean
  fallback?: () => void
}

// A request is accepted only by the mounted Fold renderer. Native links remain
// available during hydration, reduced motion and other appearance modes.
export function requestFoldTransition(request: FoldTransitionRequest) {
  if (document.documentElement.dataset.design !== 'fold') return false
  const event = new CustomEvent<FoldTransitionRequest>(FOLD_TRANSITION_EVENT, { detail: request, cancelable: true })
  document.dispatchEvent(event)
  return event.defaultPrevented
}

let covering = false
export const isFoldTransitionCovering = () => covering
export function handOffUnderFold<T>(handoff: () => T) {
  covering = true
  try { return handoff() } finally { covering = false }
}
