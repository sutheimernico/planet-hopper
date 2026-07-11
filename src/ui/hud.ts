// src/ui/hud.ts
export interface HudView {
  fuel01: number
  points: number
  mult: number
  hint: string | null // bottom-center contextual hint
  warning: string | null // void countdown etc.
  dimmed: boolean // in flight the HUD drops to 40% opacity
}

export interface Hud {
  update(view: HudView): void
}

export function createHud(root: HTMLElement): Hud {
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
    </div>`,
  )
  const el = (id: string): HTMLElement => root.querySelector(`#${id}`)!
  const hud = el('hud')
  const fuel = el('hud-fuel')
  const points = el('hud-points')
  const mult = el('hud-mult')
  const hint = el('hud-hint')
  const warning = el('hud-warning')
  return {
    update(v) {
      fuel.style.width = `${Math.round(v.fuel01 * 100)}%`
      fuel.classList.toggle('hud-fuel-low', v.fuel01 < 0.25)
      points.textContent = new Intl.NumberFormat('de-DE').format(Math.floor(v.points))
      mult.textContent = v.mult > 1 ? `×${v.mult.toFixed(1).replace('.', ',')} Flyby` : ''
      hint.textContent = v.hint ?? ''
      hint.style.opacity = v.hint ? '1' : '0'
      warning.textContent = v.warning ?? ''
      warning.style.opacity = v.warning ? '1' : '0'
      hud.classList.toggle('hud-dimmed', v.dimmed)
    },
  }
}
