// src/main.ts
import { createSceneRig } from './render/scene'

const app = document.querySelector<HTMLDivElement>('#app')
if (app) {
  const canvas = document.createElement('canvas')
  app.appendChild(canvas)
  const rig = createSceneRig(canvas)
  window.addEventListener('resize', rig.resize)
  const frame = (): void => {
    rig.updateCamera({ x: 0, y: 0 }, 0, 1 / 60)
    rig.render()
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
