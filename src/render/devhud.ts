// src/render/devhud.ts
// Dev-only fps readout, never imported outside a DEV build (see main.ts) — tree-shaken
// out of the production bundle.
export function attachDevHud(root: HTMLElement): (frameMs: number) => void {
  const el = document.createElement('div')
  el.style.cssText =
    'position:fixed;left:8px;bottom:8px;color:#0f0;font:11px ui-monospace;z-index:9;opacity:.8'
  root.appendChild(el)
  const samples: number[] = []
  return (frameMs: number) => {
    samples.push(frameMs)
    if (samples.length >= 30) {
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length
      el.textContent = `${(1000 / avg).toFixed(0)} fps · ${avg.toFixed(1)} ms`
      samples.length = 0
    }
  }
}
