// src/input/controls.ts
import { dragToAim, type Aim } from './aim'

export interface ControlsCallbacks {
  canAim(): boolean // phase === 'playing' && run.mode === 'orbiting'
  onAim(aim: Aim): void
  onRelease(aim: Aim): void
  onCancel(): void
}

const MAX_DRAG_PX = 220

// Pointer Events cover mouse + touch + pen with one code path.
export function attachControls(el: HTMLElement, cb: ControlsCallbacks): void {
  let start: { x: number; y: number } | null = null
  el.style.touchAction = 'none' // stop scroll/zoom stealing the gesture

  el.addEventListener('pointerdown', (e) => {
    if (!cb.canAim()) return
    start = { x: e.clientX, y: e.clientY }
    el.setPointerCapture(e.pointerId)
  })
  el.addEventListener('pointermove', (e) => {
    if (!start) return
    cb.onAim(dragToAim(start, { x: e.clientX, y: e.clientY }, MAX_DRAG_PX))
  })
  el.addEventListener('pointerup', (e) => {
    if (!start) return
    const aim = dragToAim(start, { x: e.clientX, y: e.clientY }, MAX_DRAG_PX)
    start = null
    if (aim.power01 > 0.05) cb.onRelease(aim)
    else cb.onCancel() // a tap, not a drag
  })
  el.addEventListener('pointercancel', () => {
    start = null
    cb.onCancel()
  })
}
