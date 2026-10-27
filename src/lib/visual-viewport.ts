// Keep overlays within the screen area left by the keyboard. Safari can resize
// only visualViewport, leaving CSS viewport units and media queries unchanged.
export function observeVisualViewport(element: HTMLElement, prefix: 'chat' | 'dialog') {
  const viewport = window.visualViewport
  const update = () => {
    element.style.setProperty(`--${prefix}-viewport-height`, `${viewport?.height ?? window.innerHeight}px`)
    element.style.setProperty(`--${prefix}-viewport-top`, `${viewport?.offsetTop ?? 0}px`)
  }
  update()
  viewport?.addEventListener('resize', update)
  viewport?.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update)
  return () => {
    viewport?.removeEventListener('resize', update)
    viewport?.removeEventListener('scroll', update)
    window.removeEventListener('resize', update)
    element.style.removeProperty(`--${prefix}-viewport-height`)
    element.style.removeProperty(`--${prefix}-viewport-top`)
  }
}
