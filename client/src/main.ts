import { CarPosition, Messages } from '../../common'

import backgroundImage from './images/background.png'
import spritesImage from './images/sprites.png'

import { COLORS, RoadColor } from './colors'
import {
  BACKGROUND_SPRITES,
  BILLBOARD_SPRITES,
  CAR_SPRITES,
  PLANT_SPRITES,
  SPRITES,
  SPRITE_SCALE
} from './sprites'

import * as Render from './render'
import {
  accelerate,
  easeIn,
  easeInOut,
  increase,
  overlap,
  randomInt,
  randomChoice,
  clamp,
  percentRemaining,
  interpolate,
  runGame,
  project,
  exponentialFog
} from './utils'
import { Position, Sprite } from './types'

const fps = 60 // how many 'update' frames per second
const step = 1 / fps // how long is each frame (in seconds)
let width = 1024 // logical canvas width
let height = 768 // logical canvas height
const centrifugal = 0.3 // centrifugal force multiplier when going around curves
const skySpeed = 0.001 // background sky layer scroll speed when going around curve (or up hill)
const hillSpeed = 0.002 // background hill layer scroll speed when going around curve (or up hill)
const treeSpeed = 0.003 // background tree layer scroll speed when going around curve (or up hill)
let skyOffset = 0 // current sky scroll offset
let hillOffset = 0 // current hill scroll offset
let treeOffset = 0 // current tree scroll offset
const segments: Segment[] = [] // array of road segments

interface Car {
  offset: number
  z: number
  sprite: Sprite
  speed: number
  percent: number
  id: number
}

let cars: Car[] = [] // array of cars on the road

const canvas = document.getElementById('canvas')! as HTMLCanvasElement
const ctx: CanvasRenderingContext2D = canvas.getContext('2d')!
if (!ctx) {
  throw new Error('Could not get canvas context!')
}
let background: HTMLImageElement // our background image (loaded below)
let sprites: HTMLImageElement // our spritesheet (loaded below)
let resolution = 1 // scaling factor to provide resolution independence (computed)
let roadWidth = 2000 // actually half the roads width, easier math if the road spans from -roadWidth to +roadWidth
let segmentLength = 200 // length of a single segment
let rumbleLength = 1 // number of segments per red/white rumble strip
let trackLength = 1 // z length of entire track (computed)
let lanes = 8 // number of lanes
let fieldOfView = 170 // angle (degrees) for field of view
let cameraHeight = 2000 // z height of camera
let cameraDepth = 0.1 // z distance camera is from screen (computed)
let drawDistance = 300 // number of segments to draw
let playerX = 0 // player x offset from center of road (-1 to 1 to stay independent of roadWidth)
let playerZ = 0 // player relative z distance from camera (computed)
let fogDensity = 0 // exponential fog density
let position = 0 // current camera Z position (add playerZ to get player's absolute Z position)
let speed = 0 // current speed
const maxSpeed = segmentLength / step // top speed (ensure we can't move more than 1 segment in a single frame to make collision detection easier)
const accel = maxSpeed / 5 // acceleration rate - tuned until it 'felt' right
const breaking = -maxSpeed // deceleration rate when braking
const decel = -maxSpeed / 5 // 'natural' deceleration rate when neither accelerating, nor braking
const offRoadDecel = -maxSpeed / 2 // off road deceleration is somewhere in between
const offRoadLimit = maxSpeed / 4 // limit when off road deceleration no longer applies (e.g. you can always go at least this speed even when off road)
let currentLapTime = 0 // current lap time

let leftPressed = false
let rightPressed = false
let accelPressed = false
let brakePressed = false

function update(dt: number) {
  const playerSegment = findSegment(position + playerZ)
  const playerW = SPRITES.PLAYER_STRAIGHT.w * SPRITE_SCALE
  const speedPercent = speed / maxSpeed
  const dx = dt * 2 * speedPercent // at top speed, should be able to cross from left to right (-1 to 1) in 1 second
  const startPosition = position

  updateCars(dt, playerSegment, playerW)

  position = increase(position, dt * speed, trackLength)

  if (leftPressed) playerX = playerX - dx
  else if (rightPressed) playerX = playerX + dx

  playerX = playerX - dx * speedPercent * playerSegment.curve * centrifugal
  if (accelPressed) {
    speed = accelerate(speed, accel, dt)
  } else if (brakePressed) {
    speed = accelerate(speed, breaking, dt)
  } else {
    speed = accelerate(speed, decel, dt)
  }

  if (playerX < -1 || playerX > 1) {
    if (speed > offRoadLimit) speed = accelerate(speed, offRoadDecel, dt)

    for (let n = 0; n < playerSegment.sprites.length; n++) {
      const sprite = playerSegment.sprites[n]
      const spriteW = sprite.source.w * SPRITE_SCALE
      if (
        overlap(
          playerX,
          playerW,
          sprite.offset + (spriteW / 2) * (sprite.offset > 0 ? 1 : -1),
          spriteW
        )
      ) {
        speed = maxSpeed / 5
        position = increase(playerSegment.p1.world.z, -playerZ, trackLength) // stop in front of sprite (at front of segment)
        break
      }
    }
  }

  for (let n = 0; n < playerSegment.cars.length; n++) {
    const car = playerSegment.cars[n]
    const carW = car.sprite.w * SPRITE_SCALE
    if (speed > car.speed) {
      if (overlap(playerX, playerW, car.offset, carW, 0.8)) {
        speed = car.speed * (car.speed / speed)
        position = increase(car.z, -playerZ, trackLength)
        break
      }
    }
  }

  playerX = clamp(playerX, -3, 3) // dont ever let it go too far out of bounds
  speed = clamp(speed, 0, maxSpeed) // or exceed maxSpeed

  skyOffset = increase(
    skyOffset,
    (skySpeed * playerSegment.curve * (position - startPosition)) /
      segmentLength,
    1
  )
  hillOffset = increase(
    hillOffset,
    (hillSpeed * playerSegment.curve * (position - startPosition)) /
      segmentLength,
    1
  )
  treeOffset = increase(
    treeOffset,
    (treeSpeed * playerSegment.curve * (position - startPosition)) /
      segmentLength,
    1
  )

  if (position > playerZ) {
    if (currentLapTime && startPosition < playerZ) {
      // TODO set lap times
      currentLapTime = 0
    } else {
      currentLapTime += dt
    }
  }
}

//-------------------------------------------------------------------------

function updateCars(dt: number, playerSegment: Segment, playerW: number) {
  for (const car of cars) {
    const oldSegment = findSegment(car.z)
    car.offset = car.offset // TODO NETWORKING MOVE LR
    car.z = increase(car.z, dt * car.speed, trackLength)
    car.percent = percentRemaining(car.z, segmentLength) // TODO NETWORKING MOVE FORWARDS // useful for interpolation during rendering phase
    const newSegment = findSegment(car.z)
    if (oldSegment != newSegment) {
      const index = oldSegment.cars.indexOf(car)
      oldSegment.cars.splice(index, 1)
      newSegment.cars.push(car)
    }
  }
  const pos: CarPosition = {
    offset: playerX,
    z: position + playerZ
  }
  ws.send(JSON.stringify(pos))
}

function render() {
  var baseSegment = findSegment(position)
  var basePercent = percentRemaining(position, segmentLength)
  var playerSegment = findSegment(position + playerZ)
  var playerPercent = percentRemaining(position + playerZ, segmentLength)
  var playerY = interpolate(
    playerSegment.p1.world.y,
    playerSegment.p2.world.y,
    playerPercent
  )
  var maxy = height

  var x = 0
  var dx = -(baseSegment.curve * basePercent)

  ctx.clearRect(0, 0, width, height)

  Render.drawBackground(
    ctx,
    background,
    width,
    height,
    BACKGROUND_SPRITES.SKY,
    skyOffset,
    resolution * skySpeed * playerY
  )
  Render.drawBackground(
    ctx,
    background,
    width,
    height,
    BACKGROUND_SPRITES.HILLS,
    hillOffset,
    resolution * hillSpeed * playerY
  )
  Render.drawBackground(
    ctx,
    background,
    width,
    height,
    BACKGROUND_SPRITES.TREES,
    treeOffset,
    resolution * treeSpeed * playerY
  )

  for (let n = 0; n < drawDistance; n++) {
    const segment = segments[(baseSegment.index + n) % segments.length]
    segment.looped = segment.index < baseSegment.index
    segment.fog = exponentialFog(n / drawDistance, fogDensity)
    segment.clip = maxy

    project(
      segment.p1,
      playerX * roadWidth - x,
      playerY + cameraHeight,
      position - (segment.looped ? trackLength : 0),
      cameraDepth,
      width,
      height,
      roadWidth
    )
    project(
      segment.p2,
      playerX * roadWidth - x - dx,
      playerY + cameraHeight,
      position - (segment.looped ? trackLength : 0),
      cameraDepth,
      width,
      height,
      roadWidth
    )

    x = x + dx
    dx = dx + segment.curve

    if (
      segment.p1.camera.z <= cameraDepth || // behind us
      segment.p2.screen.y >= segment.p1.screen.y || // back face cull
      segment.p2.screen.y >= maxy
    )
      // clip by (already rendered) hill
      continue

    Render.roadSegment(
      ctx,
      width,
      lanes,
      segment.p1.screen.x,
      segment.p1.screen.y,
      segment.p1.screen.w,
      segment.p2.screen.x,
      segment.p2.screen.y,
      segment.p2.screen.w,
      segment.fog,
      segment.color
    )

    maxy = segment.p1.screen.y
  }

  for (let n = drawDistance - 1; n > 0; n--) {
    const segment = segments[(baseSegment.index + n) % segments.length]

    for (let i = 0; i < segment.cars.length; i++) {
      const car = segment.cars[i]
      const spriteScale = interpolate(
        segment.p1.screen.scale,
        segment.p2.screen.scale,
        car.percent
      )
      const spriteX =
        interpolate(segment.p1.screen.x, segment.p2.screen.x, car.percent) +
        (spriteScale * car.offset * roadWidth * width) / 2
      const spriteY = interpolate(
        segment.p1.screen.y,
        segment.p2.screen.y,
        car.percent
      )
      Render.drawSprite(
        ctx,
        width,
        roadWidth,
        sprites,
        car.sprite,
        spriteScale,
        spriteX,
        spriteY,
        -0.5,
        -1,
        segment.clip
      )
    }

    for (let i = 0; i < segment.sprites.length; i++) {
      const sprite = segment.sprites[i]
      const spriteScale = segment.p1.screen.scale
      const spriteX =
        segment.p1.screen.x +
        (spriteScale * sprite.offset * roadWidth * width) / 2
      const spriteY = segment.p1.screen.y
      Render.drawSprite(
        ctx,
        width,
        roadWidth,
        sprites,
        sprite.source,
        spriteScale,
        spriteX,
        spriteY,
        sprite.offset < 0 ? -1 : 0,
        -1,
        segment.clip
      )
    }

    if (segment == playerSegment) {
      Render.drawPlayer(
        ctx,
        width,
        resolution,
        roadWidth,
        sprites,
        speed / maxSpeed,
        cameraDepth / playerZ,
        width / 2,
        height / 2 -
          ((cameraDepth / playerZ) *
            interpolate(
              playerSegment.p1.camera.y,
              playerSegment.p2.camera.y,
              playerPercent
            ) *
            height) /
            2,
        speed * (leftPressed ? -1 : rightPressed ? 1 : 0),
        playerSegment.p2.world.y - playerSegment.p1.world.y
      )
    }
  }
}

function findSegment(z: number): Segment {
  return segments[Math.floor(z / segmentLength) % segments.length]
}

//=========================================================================
// BUILD ROAD GEOMETRY
//=========================================================================

function lastY() {
  return segments.length == 0 ? 0 : segments[segments.length - 1].p2.world.y
}

function makePosition(y: number, z: number): Position {
  return {
    world: { x: 0, y, z },
    camera: { x: 0, y: 0, z: 0 },
    screen: { x: 0, y: 0, w: 0, scale: 0 }
  }
}

interface Segment {
  index: number
  p1: Position
  p2: Position
  curve: number
  sprites: Array<{ source: Sprite; offset: number }>
  cars: Car[]
  color: RoadColor
  looped: boolean
  fog: number
  clip: number
}

function addSegment(curve: number, y: number) {
  const n = segments.length
  segments.push({
    index: n,
    p1: makePosition(lastY(), n * segmentLength),
    p2: makePosition(y, (n + 1) * segmentLength),
    curve: curve,
    sprites: [],
    cars: [],
    color:
      Math.floor(n / rumbleLength) % 2 ? COLORS.ROAD.DARK : COLORS.ROAD.LIGHT,
    looped: false,
    fog: 0,
    clip: 0
  })
}

function addSprite(n: number, sprite: Sprite, offset: number) {
  segments[n].sprites.push({ source: sprite, offset: offset })
}

function addRoad(
  enter: number,
  hold: number,
  leave: number,
  curve: number,
  y: number
) {
  var startY = lastY()
  var endY = startY + y * segmentLength
  var n,
    total = enter + hold + leave
  for (n = 0; n < enter; n++)
    addSegment(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total))
  for (n = 0; n < hold; n++)
    addSegment(curve, easeInOut(startY, endY, (enter + n) / total))
  for (n = 0; n < leave; n++)
    addSegment(
      easeInOut(curve, 0, n / leave),
      easeInOut(startY, endY, (enter + hold + n) / total)
    )
}

const ROAD = {
  LENGTH: { NONE: 0, SHORT: 25, MEDIUM: 50, LONG: 100 },
  HILL: { NONE: 0, LOW: 20, MEDIUM: 40, HIGH: 60 },
  CURVE: { NONE: 0, EASY: 2, MEDIUM: 4, HARD: 6 }
} as const

function addStraight(length: number = ROAD.LENGTH.MEDIUM) {
  addRoad(length, length, length, 0, 0)
}

function addHill(
  length: number = ROAD.LENGTH.MEDIUM,
  height: number = ROAD.HILL.MEDIUM
) {
  addRoad(length, length, length, 0, height)
}

function addCurve(
  length: number = ROAD.LENGTH.MEDIUM,
  curve: number = ROAD.CURVE.MEDIUM,
  height: number = ROAD.HILL.NONE
) {
  addRoad(length, length, length, curve, height)
}

function addLowRollingHills(
  length: number = ROAD.LENGTH.SHORT,
  height: number = ROAD.HILL.LOW
) {
  addRoad(length, length, length, 0, height / 2)
  addRoad(length, length, length, 0, -height)
  addRoad(length, length, length, ROAD.CURVE.EASY, height)
  addRoad(length, length, length, 0, 0)
  addRoad(length, length, length, -ROAD.CURVE.EASY, height / 2)
  addRoad(length, length, length, 0, 0)
}

function addSCurves() {
  addRoad(
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    -ROAD.CURVE.EASY,
    ROAD.HILL.NONE
  )
  addRoad(
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    ROAD.CURVE.MEDIUM,
    ROAD.HILL.MEDIUM
  )
  addRoad(
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    ROAD.CURVE.EASY,
    -ROAD.HILL.LOW
  )
  addRoad(
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    -ROAD.CURVE.EASY,
    ROAD.HILL.MEDIUM
  )
  addRoad(
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    -ROAD.CURVE.MEDIUM,
    -ROAD.HILL.MEDIUM
  )
}

function addBumps() {
  addRoad(10, 10, 10, 0, 5)
  addRoad(10, 10, 10, 0, -2)
  addRoad(10, 10, 10, 0, -5)
  addRoad(10, 10, 10, 0, 8)
  addRoad(10, 10, 10, 0, 5)
  addRoad(10, 10, 10, 0, -7)
  addRoad(10, 10, 10, 0, 5)
  addRoad(10, 10, 10, 0, -2)
}

function addDownhillToEnd(num: number = 200) {
  addRoad(num, num, num, -ROAD.CURVE.EASY, -lastY() / segmentLength)
}

function resetRoad() {
  segments.length = 0

  // addStraight(ROAD.LENGTH.SHORT)
  // addStraight(ROAD.LENGTH.SHORT)
  // addStraight(ROAD.LENGTH.SHORT)
  // addStraight(ROAD.LENGTH.SHORT)
  // addStraight(ROAD.LENGTH.SHORT)
  // addStraight(ROAD.LENGTH.SHORT)
  addLowRollingHills()
  addSCurves()
  addCurve(ROAD.LENGTH.MEDIUM, ROAD.CURVE.MEDIUM, ROAD.HILL.LOW)
  addBumps()
  addLowRollingHills()
  addCurve(ROAD.LENGTH.LONG * 2, ROAD.CURVE.MEDIUM, ROAD.HILL.MEDIUM)
  addStraight()
  addHill(ROAD.LENGTH.MEDIUM, ROAD.HILL.HIGH)
  addSCurves()
  addCurve(ROAD.LENGTH.LONG, -ROAD.CURVE.MEDIUM, ROAD.HILL.NONE)
  addHill(ROAD.LENGTH.LONG, ROAD.HILL.HIGH)
  addCurve(ROAD.LENGTH.LONG, ROAD.CURVE.MEDIUM, -ROAD.HILL.LOW)
  addBumps()
  addHill(ROAD.LENGTH.LONG, -ROAD.HILL.MEDIUM)
  addStraight()
  addSCurves()
  addDownhillToEnd()

  resetSprites()

  segments[findSegment(playerZ).index + 2].color = COLORS.ROAD.START
  segments[findSegment(playerZ).index + 3].color = COLORS.ROAD.START
  for (var n = 0; n < rumbleLength; n++)
    segments[segments.length - 1 - n].color = COLORS.ROAD.FINISH

  trackLength = segments.length * segmentLength
}

function resetSprites() {
  addSprite(20, SPRITES.BILLBOARD07, -1)
  addSprite(40, SPRITES.BILLBOARD06, -1)
  addSprite(60, SPRITES.BILLBOARD08, -1)
  addSprite(80, SPRITES.BILLBOARD09, -1)
  addSprite(100, SPRITES.BILLBOARD01, -1)
  addSprite(120, SPRITES.BILLBOARD02, -1)
  addSprite(140, SPRITES.BILLBOARD03, -1)
  addSprite(160, SPRITES.BILLBOARD04, -1)
  addSprite(180, SPRITES.BILLBOARD05, -1)

  addSprite(240, SPRITES.BILLBOARD07, -1.2)
  addSprite(240, SPRITES.BILLBOARD06, 1.2)
  addSprite(segments.length - 25, SPRITES.BILLBOARD07, -1.2)
  addSprite(segments.length - 25, SPRITES.BILLBOARD06, 1.2)

  for (let n = 10; n < 200; n += 4 + Math.floor(n / 100)) {
    addSprite(n, SPRITES.PALM_TREE, 0.5 + Math.random() * 0.5)
    addSprite(n, SPRITES.PALM_TREE, 1 + Math.random() * 2)
  }

  for (let n = 250; n < 1000; n += 5) {
    addSprite(n, SPRITES.COLUMN, 1.1)
    addSprite(n + randomInt(0, 5), SPRITES.TREE1, -1 - Math.random() * 2)
    addSprite(n + randomInt(0, 5), SPRITES.TREE2, -1 - Math.random() * 2)
  }

  for (let n = 200; n < segments.length; n += 3) {
    addSprite(
      n,
      randomChoice(PLANT_SPRITES),
      randomChoice([1, -1]) * (2 + Math.random() * 5)
    )
  }

  var side, sprite, offset
  for (let n = 1000; n < segments.length - 50; n += 100) {
    side = randomChoice([1, -1])
    addSprite(n + randomInt(0, 50), randomChoice(BILLBOARD_SPRITES), -side)
    for (let i = 0; i < 20; i++) {
      sprite = randomChoice(PLANT_SPRITES)
      offset = side * (1.5 + Math.random())
      addSprite(n + randomInt(0, 50), sprite, offset)
    }
  }
}

function reset(options: {
  width?: number
  height?: number
  lanes?: number
  roadWidth?: number
  cameraHeight?: number
  drawDistance?: number
  fogDensity?: number
  fieldOfView?: number
  segmentLength?: number
  rumbleLength?: number
}) {
  options = options || {}
  canvas.width = width = options.width ?? width
  canvas.height = height = options.height ?? height
  lanes = options.lanes ?? lanes
  roadWidth = options.roadWidth ?? roadWidth
  cameraHeight = options.cameraHeight ?? cameraHeight
  drawDistance = options.drawDistance ?? drawDistance
  fogDensity = options.fogDensity ?? fogDensity
  fieldOfView = options.fieldOfView ?? fieldOfView
  segmentLength = options.segmentLength ?? segmentLength
  rumbleLength = options.rumbleLength ?? rumbleLength
  cameraDepth = 1 / Math.tan(((fieldOfView / 2) * Math.PI) / 180)
  playerZ = cameraHeight * cameraDepth
  resolution = height / 480

  if (segments.length == 0 || options.segmentLength || options.rumbleLength) {
    resetRoad()
  }
}

const resolutions = {
  low: { width: 480, height: 360 },
  medium: { width: 640, height: 480 },
  high: { width: 1024, height: 768 },
  ultra: { width: 1280, height: 960 }
} as const

//=========================================================================
// THE GAME LOOP
//=========================================================================

const ws = new WebSocket('ws://localhost:8080')
ws.addEventListener('message', (message) => {
  if (!segments.length) {
    return
  }
  const data = JSON.parse(message.data)
  if ('cars' in data) {
    const d = data as { cars: Array<{ id: number; offset: number; z: number }> }
    const ids = d.cars.map((c) => c.id)
    const existingIDs = cars.map((c) => c.id)
    cars = cars.filter((c) => ids.includes(c.id))
    const newCars = d.cars.filter((car) => !existingIDs.includes(car.id))
    const c = newCars.map((car) => ({
      id: car.id,
      offset: car.offset,
      z: car.z,
      sprite: CAR_SPRITES[car.id % CAR_SPRITES.length],
      speed: 0,
      percent: 0
    }))
    cars.push(...c)
    for (const newCar of c) {
      const segment = findSegment(newCar.z)
      segment.cars.push(newCar)
    }
    for (const car of cars) {
      const remoteCar = d.cars.find((c) => c.id === car.id)
      if (!remoteCar) {
        throw new Error('Expected one remote car for each local car')
      }
      const oldSegment = findSegment(car.z)

      car.offset = remoteCar.offset
      car.z = remoteCar.z

      const newSegment = findSegment(car.z)
      if (oldSegment != newSegment) {
        const index = oldSegment.cars.indexOf(car)
        oldSegment.cars.splice(index, 1)
        newSegment.cars.push(car)
      }
    }
  }
})

runGame({
  canvas: canvas,
  render: render,
  update: update,
  step: step,
  images: [backgroundImage, spritesImage],
  keys: [
    {
      keys: ['ArrowLeft', 'KeyA'],
      mode: 'down',
      action() {
        leftPressed = true
      }
    },
    {
      keys: ['ArrowLeft', 'KeyA'],
      mode: 'up',
      action() {
        leftPressed = false
      }
    },

    {
      keys: ['ArrowRight', 'KeyD'],
      mode: 'down',
      action() {
        rightPressed = true
      }
    },
    {
      keys: ['ArrowRight', 'KeyD'],
      mode: 'up',
      action() {
        rightPressed = false
      }
    },

    {
      keys: ['ArrowUp', 'KeyW'],
      mode: 'down',
      action() {
        accelPressed = true
      }
    },
    {
      keys: ['ArrowUp', 'KeyW'],
      mode: 'up',
      action() {
        accelPressed = false
      }
    },
    {
      keys: ['ArrowDown', 'KeyS'],
      mode: 'down',
      action() {
        brakePressed = true
      }
    },
    {
      keys: ['ArrowDown', 'KeyS'],
      mode: 'up',
      action() {
        brakePressed = false
      }
    }
  ],
  ready(images) {
    background = images[0]
    sprites = images[1]
    reset({})
  }
})
