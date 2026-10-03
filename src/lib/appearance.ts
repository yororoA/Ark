export const DESIGN_KEY = 'ark.design.v1'
// Retain the original preference when upgrading from the archive-only UI.
export const COLOR_MODE_KEY = 'ark.theme'
export const DESIGNS = ['archive', 'rain'] as const
export const COLOR_MODES = ['light', 'dark', 'system'] as const
export type Design = typeof DESIGNS[number]
export type ColorMode = typeof COLOR_MODES[number]

export function parseDesign(value: unknown): Design {
  return value === 'rain' ? 'rain' : 'archive'
}

export function parseColorMode(value: unknown): ColorMode {
  return value === 'light' || value === 'dark' ? value : 'system'
}

// Run in the head before the first paint. All interpolated values are constants.
// Keep the same allowlists/fallbacks as the parsers above.
export const APPEARANCE_BOOTSTRAP = `(() => {
  const root = document.documentElement;
  let design, mode;
  try { design = localStorage.getItem('${DESIGN_KEY}'); mode = localStorage.getItem('${COLOR_MODE_KEY}'); } catch {}
  root.dataset.design = design === 'rain' ? 'rain' : 'archive';
  root.dataset.theme = mode === 'light' || mode === 'dark' ? mode : 'system';
})();`
