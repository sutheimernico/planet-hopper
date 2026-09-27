// src/ui/toast.ts
// Non-blocking milestone toast: fixed overlay (no layout shift), pointer-events none so it
// never eats the drag gesture. Queued — each text gets its full SHOW_SECONDS.
const SHOW_SECONDS = 2

export interface Toasts {
  show(text: string): void
  update(dt: number): void // once per rendered frame
  clear(): void
}

export function createToasts(root: HTMLElement): Toasts {
  root.insertAdjacentHTML('beforeend', `<div id="toast" class="toast" aria-live="polite"></div>`)
  const el = root.querySelector<HTMLDivElement>('#toast')!
  const queue: string[] = []
  let remaining = 0

  const hide = (): void => {
    remaining = 0
    el.classList.remove('toast-visible')
  }
  return {
    show: (text) => void queue.push(text),
    update(dt) {
      if (remaining > 0) {
        remaining -= dt
        if (remaining <= 0) hide()
        return
      }
      const next = queue.shift()
      if (next === undefined) return
      el.textContent = next
      el.classList.add('toast-visible')
      remaining = SHOW_SECONDS
    },
    clear() {
      queue.length = 0
      hide()
    },
  }
}
