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
  // only the pointer that started the drag may aim/release/cancel it — a second
  // finger must not hijack or spuriously end the gesture (review finding, 2026-07-11)
  let activeId: number | null = null
  el.style.touchAction = 'none' // stop scroll/zoom stealing the gesture

  el.addEventListener('pointerdown', (e) => {
    if (activeId !== null) return // a drag is already in progress
    if (e.button !== 0) return // primary button/contact only (review finding, 2026-07-11)
    if (!cb.canAim()) return
    start = { x: e.clientX, y: e.clientY }
    activeId = e.pointerId
    el.setPointerCapture(e.pointerId)
  })
  el.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== activeId) return
    cb.onAim(dragToAim(start, { x: e.clientX, y: e.clientY }, MAX_DRAG_PX))
  })
  el.addEventListener('pointerup', (e) => {
    if (!start || e.pointerId !== activeId) return
    const aim = dragToAim(start, { x: e.clientX, y: e.clientY }, MAX_DRAG_PX)
    start = null
    activeId = null
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    if (aim.power01 > 0.05) cb.onRelease(aim)
    else cb.onCancel() // a tap, not a drag
  })
  el.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== activeId) return
    start = null
    activeId = null
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    cb.onCancel()
  })
}
