// src/ui/screens.ts
export interface StartView {
  highscore: number
  seedLabel: string | null // set when the page was opened with a valid ?seed= link
  dailyBest: number // today's daily-challenge best (0 = not played yet)
}

export interface RunStats {
  points: number
  crystals: number
  best: number // best for this mode: endless highscore or the seed's record
  isNewBest: boolean
  bestLabel: string // "Rekord" / "Tagesrekord" / "Seed-Rekord"
  runLabel: string | null // "Tages-Challenge 2026-07-21" etc.; null for endless runs
  shareText: string | null // seeded runs only
  cause: 'sun' | 'void' | 'stranded'
}

export interface Screens {
  showStart(view: StartView): void
  showPause(): void
  showGameOver(stats: RunStats): void
  hide(): void
}

export interface ScreenActions {
  onStart(): void
  onDaily(): void
  onResume(): void
  onRestart(): void
  onMenu(): void
}

const CAUSE_TEXT: Record<RunStats['cause'], string> = {
  sun: 'In der Sonne verglüht',
  void: 'In der Leere verloren',
  stranded: 'Ohne Treibstoff gestrandet',
}

const fmt = (n: number): string => new Intl.NumberFormat('de-DE').format(Math.floor(n))

// labels are built from validated seeds ([A-Za-z0-9_-]) — escaped anyway, it is innerHTML
const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export function createScreens(root: HTMLElement, actions: ScreenActions): Screens {
  root.insertAdjacentHTML('beforeend', `<div id="screen" class="screen"></div>`)
  const el = root.querySelector<HTMLDivElement>('#screen')!
  let share: string | null = null

  const render = (html: string): void => {
    el.innerHTML = html
    el.classList.add('screen-visible')
  }

  // Clipboard API where allowed; otherwise (http, denied permission, old browser) the text
  // appears pre-selected for manual copying — the share never silently fails.
  const doShare = async (btn: HTMLElement): Promise<void> => {
    if (!share) return
    try {
      await navigator.clipboard.writeText(share)
      btn.textContent = 'Kopiert!'
    } catch {
      const box = el.querySelector<HTMLTextAreaElement>('#screen-share')!
      box.hidden = false
      box.select()
    }
  }

  el.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const action = target.dataset['action']
    if (action === 'start') actions.onStart()
    if (action === 'daily') actions.onDaily()
    if (action === 'resume') actions.onResume()
    if (action === 'restart') actions.onRestart()
    if (action === 'menu') actions.onMenu()
    if (action === 'share') void doShare(target)
  })

  return {
    showStart(v) {
      render(`
        <h1>Planet Hopper</h1>
        <p class="screen-sub">Ziehen zum Zielen · loslassen zum Starten.<br>
        Schwing dich per Gravitation von Planet zu Planet — knappe Vorbeiflüge geben Bonus.</p>
        ${v.highscore > 0 ? `<p class="screen-high">Rekord: ${fmt(v.highscore)}</p>` : ''}
        <button class="screen-btn" data-action="start">
          ${v.seedLabel ? `${esc(v.seedLabel)} spielen` : 'Start'}</button>
        <button class="screen-btn screen-btn-alt" data-action="daily">Tages-Challenge</button>
        ${v.dailyBest > 0 ? `<p class="screen-note">Heute bisher: ${fmt(v.dailyBest)} Punkte</p>` : ''}`)
    },
    showPause() {
      render(`
        <h1>Pause</h1>
        <button class="screen-btn" data-action="resume">Weiter</button>`)
    },
    showGameOver(s) {
      share = s.shareText
      render(`
        <h1>${CAUSE_TEXT[s.cause]}</h1>
        ${s.runLabel ? `<p class="screen-note">${esc(s.runLabel)}</p>` : ''}
        <p class="screen-score">${fmt(s.points)} Punkte · ${s.crystals} Kristalle</p>
        <p class="screen-high">${s.isNewBest ? `Neuer ${s.bestLabel}!` : `${s.bestLabel}: ${fmt(s.best)}`}</p>
        <button class="screen-btn" data-action="restart">Nochmal</button>
        ${s.shareText ? `<button class="screen-btn screen-btn-alt" data-action="share">Teilen</button>
          <textarea id="screen-share" class="screen-share" readonly hidden>${esc(s.shareText)}</textarea>` : ''}
        <button class="screen-link" data-action="menu">Menü</button>`)
    },
    hide() {
      el.classList.remove('screen-visible')
      el.innerHTML = ''
    },
  }
}
