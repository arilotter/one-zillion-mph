//=========================================================================
// general purpose helpers (mostly math)
//=========================================================================

import { Position } from './types'

export function timestamp() {
  return new Date().getTime()
}

export function project(
  p: Position,
  cameraX: number,
  cameraY: number,
  cameraZ: number,
  cameraDepth: number,
  width: number,
  height: number,
  roadWidth: number
) {
  p.camera.x = (p.world.x || 0) - cameraX
  p.camera.y = (p.world.y || 0) - cameraY
  p.camera.z = (p.world.z || 0) - cameraZ
  p.screen.scale = cameraDepth / p.camera.z
  p.screen.x = Math.round(width / 2 + (p.screen.scale * p.camera.x * width) / 2)
  p.screen.y = Math.round(
    height / 2 - (p.screen.scale * p.camera.y * height) / 2
  )
  p.screen.w = Math.round((p.screen.scale * roadWidth * width) / 2)
}

/// does range 1 overlap range 2 more than percent?
export function overlap(
  x1: number,
  w1: number,
  x2: number,
  w2: number,
  percent?: number
) {
  var half = (percent || 1) / 2
  var min1 = x1 - w1 * half
  var max1 = x1 + w1 * half
  var min2 = x2 - w2 * half
  var max2 = x2 + w2 * half
  return !(max1 < min2 || min1 > max2)
}

async function loadImages(urls: string[]): Promise<Array<HTMLImageElement>> {
  const images: HTMLImageElement[] = []
  let count = urls.length

  return new Promise((resolve) => {
    for (const url of urls) {
      const image = document.createElement('img')
      images.push(image)
      image.addEventListener('load', () => {
        if (--count === 0) {
          resolve(images)
        }
      })
      image.src = url
    }
  })
}

export async function runGame(options: {
  canvas: HTMLCanvasElement
  images: string[]
  ready: (images: HTMLImageElement[]) => void
  update: (dt: number) => void
  render: () => void
  step: number
  keys: KeyListener[]
}) {
  const images = await loadImages(options.images)

  options.ready(images)

  setKeyListeners(options.keys)

  let last = timestamp()

  let globalDt = 0

  function renderFrame() {
    const now = timestamp()
    const dt = Math.min(1, (now - last) / 1000)
    globalDt += dt
    while (globalDt > options.step) {
      globalDt = globalDt - options.step
      options.update(options.step)
    }
    options.render()
    last = now
    requestAnimationFrame(renderFrame)
  }
  renderFrame()
}

type Key =
  | `Arrow${'Left' | 'Right' | 'Up' | 'Down'}`
  | `Key${'W' | 'S' | 'A' | 'D'}`

interface KeyListener {
  mode: 'up' | 'down'
  keys: Key[]
  action: () => void
}

function setKeyListeners(keys: KeyListener[]) {
  for (const direction of ['up', 'down'] as const) {
    document.addEventListener(`key${direction}`, (ev) => {
      for (const key of keys) {
        if (key.mode !== direction) {
          continue
        }
        for (const code of key.keys) {
          if (ev.code === code) {
            key.action()
          }
        }
        if ((key.keys as string[]).includes(ev.key)) {
          key.action()
        }
      }
    })
  }
}

export function int(maybeNum: any, defaultNum: number) {
  const num = Number.parseInt(maybeNum, 10)
  return Number.isNaN(num) ? defaultNum : num
}

export function interpolate(a: number, b: number, percent: number): number {
  return a + (b - a) * percent
}

export function randomInt(min: number, max: number): number {
  return Math.round(interpolate(min, max, Math.random()))
}

export function randomChoice<T = any>(options: readonly T[]): T {
  return options[randomInt(0, options.length - 1)]
}

export function accelerate(v: number, accel: number, dt: number): number {
  return v + accel * dt
}

/// increment with wraparound from 0-max
export function increase(
  start: number,
  increment: number,
  max: number
): number {
  let result = start + increment
  while (result >= max) {
    result -= max
  }
  while (result < 0) {
    result += max
  }
  return result
}

export function easeIn(a: number, b: number, percent: number): number {
  return a + (b - a) * Math.pow(percent, 2)
}
export function easeOut(a: number, b: number, percent: number): number {
  return a + (b - a) * (1 - Math.pow(1 - percent, 2))
}
export function easeInOut(a: number, b: number, percent: number): number {
  return a + (b - a) * (-Math.cos(percent * Math.PI) / 2 + 0.5)
}

export function clamp(num: number, min: number, max: number): number {
  return Math.max(min, Math.min(num, max))
}

export function percentRemaining(n: number, total: number): number {
  return (n % total) / total
}

export function exponentialFog(distance: number, density: number) {
  return 1 / Math.pow(Math.E, distance * distance * density)
}
