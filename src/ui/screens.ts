// src/ui/screens.ts
export interface RunStats {
  points: number
  crystals: number
  highscore: number
  isNewHighscore: boolean
  cause: 'sun' | 'void' | 'stranded'
}

export interface Screens {
  showStart(highscore: number): void
  showPause(): void
  showGameOver(stats: RunStats): void
  hide(): void
}

const CAUSE_TEXT: Record<RunStats['cause'], string> = {
  sun: 'In der Sonne verglüht',
  void: 'In der Leere verloren',
  stranded: 'Ohne Treibstoff gestrandet',
}

const fmt = (n: number): string => new Intl.NumberFormat('de-DE').format(Math.floor(n))

export function createScreens(
  root: HTMLElement,
  actions: { onStart(): void; onResume(): void; onRestart(): void },
): Screens {
  root.insertAdjacentHTML('beforeend', `<div id="screen" class="screen"></div>`)
  const el = root.querySelector<HTMLDivElement>('#screen')!

  const render = (html: string): void => {
    el.innerHTML = html
    el.classList.add('screen-visible')
  }
  el.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).dataset['action']
    if (action === 'start') actions.onStart()
    if (action === 'resume') actions.onResume()
    if (action === 'restart') actions.onRestart()
  })

  return {
    showStart(highscore) {
      render(`
        <h1>Planet Hopper</h1>
        <p class="screen-sub">Ziehen zum Zielen · loslassen zum Starten.<br>
        Schwing dich per Gravitation von Planet zu Planet — knappe Vorbeiflüge geben Bonus.</p>
        ${highscore > 0 ? `<p class="screen-high">Rekord: ${fmt(highscore)}</p>` : ''}
        <button class="screen-btn" data-action="start">Start</button>`)
    },
    showPause() {
      render(`
        <h1>Pause</h1>
        <button class="screen-btn" data-action="resume">Weiter</button>`)
    },
    showGameOver(s) {
      render(`
        <h1>${CAUSE_TEXT[s.cause]}</h1>
        <p class="screen-score">${fmt(s.points)} Punkte · ${s.crystals} Kristalle</p>
        <p class="screen-high">${s.isNewHighscore ? 'Neuer Rekord!' : `Rekord: ${fmt(s.highscore)}`}</p>
        <button class="screen-btn" data-action="restart">Nochmal</button>`)
    },
    hide() {
      el.classList.remove('screen-visible')
      el.innerHTML = ''
    },
  }
}
