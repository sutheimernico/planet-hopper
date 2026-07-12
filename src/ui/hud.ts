// src/ui/hud.ts
export interface HudView {
  fuel01: number
  points: number
  mult: number
  hint: string | null // bottom-center contextual hint
  warning: string | null // void countdown etc.
  dimmed: boolean // in flight the HUD drops to 40% opacity
  showPause: boolean // pause button only makes sense while actually playing (spec §6)
}

export interface Hud {
  update(view: HudView): void
}

export interface HudOptions {
  onToggleMute(): boolean // returns new muted state
  onPause(): void // touch-friendly equivalent of Esc (spec §6, final review)
}

// hoisted — constructing this on every update() call (60/s) allocates needlessly
// (review finding, Task 18 review)
const numberFmt = new Intl.NumberFormat('de-DE')

export function createHud(root: HTMLElement, options: HudOptions): Hud {
  root.insertAdjacentHTML(
    'beforeend',
    `<div id="hud">
      <div class="hud-corner hud-tl">
        <span class="hud-label">Treibstoff</span>
        <div class="hud-fuelbar"><div id="hud-fuel" class="hud-fuelfill"></div></div>
      </div>
      <div class="hud-corner hud-tr">
        <span class="hud-label">Punkte</span>
        <div id="hud-points" class="hud-num">0</div>
        <div id="hud-mult" class="hud-num hud-combo"></div>
      </div>
      <div id="hud-warning" class="hud-warning"></div>
      <div id="hud-hint" class="hud-hint"></div>
      <button id="hud-mute" class="hud-mute" aria-label="Ton an/aus">🔊</button>
      <button id="hud-pause" class="hud-pause" aria-label="Pause">⏸</button>
    </div>`,
  )
  const el = (id: string): HTMLElement => root.querySelector(`#${id}`)!
  const hud = el('hud')
  const fuel = el('hud-fuel')
  const points = el('hud-points')
  const mult = el('hud-mult')
  const hint = el('hud-hint')
  const warning = el('hud-warning')
  const muteBtn = el('hud-mute')
  muteBtn.addEventListener('click', () => {
    muteBtn.textContent = options.onToggleMute() ? '🔇' : '🔊'
  })
  const pauseBtn = el('hud-pause')
  pauseBtn.addEventListener('click', () => options.onPause())
  return {
    update(v) {
      fuel.style.width = `${Math.round(v.fuel01 * 100)}%`
      fuel.classList.toggle('hud-fuel-low', v.fuel01 < 0.25)
      points.textContent = numberFmt.format(Math.floor(v.points))
      mult.textContent = v.mult > 1 ? `×${v.mult.toFixed(1).replace('.', ',')} Flyby` : ''
      hint.textContent = v.hint ?? ''
      hint.style.opacity = v.hint ? '1' : '0'
      warning.textContent = v.warning ?? ''
      warning.style.opacity = v.warning ? '1' : '0'
      hud.classList.toggle('hud-dimmed', v.dimmed)
      pauseBtn.hidden = !v.showPause
    },
  }
}
