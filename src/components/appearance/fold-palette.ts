export interface FoldPalette {
  paper: string
  carbon: string
  slate: string
  mist: string
  signal: string
  ink: string
  line: string
}

export function readFoldPalette(): FoldPalette {
  const style = getComputedStyle(document.documentElement)
  const color = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return {
    paper: color('--ark-fold-paper', '#eeeee1'),
    carbon: color('--ark-fold-carbon', '#11191d'),
    slate: color('--ark-fold-slate', '#485c65'),
    mist: color('--ark-fold-mist', '#a9b9c9'),
    signal: color('--ark-fold-signal', '#b6392a'),
    ink: color('--ark-ink', '#172125'),
    line: color('--ark-line', '#bdc3ba'),
  }
}

// Canvas does not inherit CSS colors. Refresh its palette without resetting
// the sequence when either the chosen mode or the system preference changes.
export function observeFoldPalette(onChange: (palette: FoldPalette) => void) {
  const update = () => onChange(readFoldPalette())
  const observer = new MutationObserver(update)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-design'] })
  const system = matchMedia('(prefers-color-scheme: dark)')
  system.addEventListener('change', update)
  return () => {
    observer.disconnect()
    system.removeEventListener('change', update)
  }
}
