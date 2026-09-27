// src/render/devhud.ts
// Dev-only frame readout, never imported outside a DEV build (see main.ts) — tree-shaken
// out of the production bundle.
import { createFrameStats } from '../core/frame-stats'

export function attachDevHud(root: HTMLElement): (now: number, cpuMs: number) => void {
  const el = document.createElement('div')
  // bottom raised past the touch pause button (bottom-left, 42px tall + 16px inset,
  // final review) so the dev-only readout doesn't sit under it in `npm run dev`
  el.style.cssText =
    'position:fixed;left:8px;bottom:66px;color:#0f0;font:11px ui-monospace;z-index:9;opacity:.8'
  root.appendChild(el)
  const stats = createFrameStats(30)
  return (now, cpuMs) => {
    const s = stats.push(now, cpuMs)
    if (s) {
      el.textContent =
        `${s.fps.toFixed(0)} fps · ${s.frameMs.toFixed(1)} ms/frame · ${s.cpuMs.toFixed(1)} ms cpu`
    }
  }
}
