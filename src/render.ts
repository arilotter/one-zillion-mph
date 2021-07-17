import { COLORS, RoadColor } from './colors'
import { Position, SPRITES, SPRITE_SCALE } from './sprites'
import { Sprite } from './types'
import { randomChoice } from './utils'

export function filledQuad(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
  color: CanvasFillStrokeStyles['fillStyle']
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x3, y3)
  ctx.lineTo(x4, y4)
  ctx.closePath()
  ctx.fill()
}

export function roadSegment(
  ctx: CanvasRenderingContext2D,
  width: number,
  lanes: number,
  x1: number,
  y1: number,
  w1: number,
  x2: number,
  y2: number,
  w2: number,
  fog: number,
  color: RoadColor
) {
  const r1 = rumbleWidth(w1, lanes)
  const r2 = rumbleWidth(w2, lanes)
  const l1 = laneMarkerWidth(w1, lanes)
  const l2 = laneMarkerWidth(w2, lanes)

  ctx.fillStyle = color.grass
  ctx.fillRect(0, y2, width, y1 - y2)

  filledQuad(
    ctx,
    x1 - w1 - r1,
    y1,
    x1 - w1,
    y1,
    x2 - w2,
    y2,
    x2 - w2 - r2,
    y2,
    color.rumble
  )
  filledQuad(
    ctx,
    x1 + w1 + r1,
    y1,
    x1 + w1,
    y1,
    x2 + w2,
    y2,
    x2 + w2 + r2,
    y2,
    color.rumble
  )
  filledQuad(
    ctx,
    x1 - w1,
    y1,
    x1 + w1,
    y1,
    x2 + w2,
    y2,
    x2 - w2,
    y2,
    color.road
  )

  if ('lane' in color) {
    const lanew1 = (w1 * 2) / lanes
    const lanew2 = (w2 * 2) / lanes
    let lanex1 = x1 - w1 + lanew1
    let lanex2 = x2 - w2 + lanew2
    for (let lane = 1; lane < lanes; lane++) {
      lanex1 += lanew1
      lanex2 += lanew2 // todo maybe these 2 lines need to go underneath?
      filledQuad(
        ctx,
        lanex1 - l1 / 2,
        y1,
        lanex1 + l1 / 2,
        y1,
        lanex2 + l2 / 2,
        y2,
        lanex2 - l2 / 2,
        y2,
        color.lane
      )
    }
  }

  drawFog(ctx, 0, y1, width, y2 - y1, fog)
}

function drawFog(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  // 0 - 1
  fog: number
) {
  if (fog < 1) {
    ctx.globalAlpha = 1 - fog
    ctx.fillStyle = COLORS.FOG
    ctx.fillRect(x, y, width, height)
    ctx.globalAlpha = 1
  }
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  background: CanvasImageSource,
  width: number,
  height: number,
  layer: Position,
  rotation = 0,
  offset = 0
) {
  const imageW = layer.w / 2
  const imageH = layer.h

  const sourceX = layer.x + Math.floor(layer.w * rotation)
  const sourceY = layer.y
  const sourceW = Math.min(imageW, layer.x + layer.w - sourceX)
  const sourceH = imageH

  const destX = 0
  const destY = offset
  const destW = Math.floor(width * (sourceW / imageW))
  const destH = height

  ctx.drawImage(
    background,
    sourceX,
    sourceY,
    sourceW,
    sourceH,
    destX,
    destY,
    destW,
    destH
  )
  if (sourceW < imageW) {
    ctx.drawImage(
      background,
      layer.x,
      sourceY,
      imageW - sourceW,
      sourceH,
      destW - 1,
      destY,
      width - destW,
      destH
    )
  }
}

function rumbleWidth(projectedRoadWidth: number, lanes: number) {
  return projectedRoadWidth / Math.max(6, 2 * lanes)
}

function laneMarkerWidth(projectedRoadWidth: number, lanes: number) {
  return projectedRoadWidth / Math.max(32, 8 * lanes)
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  width: number,
  roadWidth: number,
  sprites: CanvasImageSource,
  sprite: Sprite,
  scale: number,
  destX: number,
  destY: number,
  offsetX = 0,
  offsetY = 0,
  clipY?: number
) {
  //  scale for projection AND relative to roadWidth (for tweakUI)
  const destW = ((sprite.w * scale * width) / 2) * (SPRITE_SCALE * roadWidth)
  const destH = ((sprite.h * scale * width) / 2) * (SPRITE_SCALE * roadWidth)

  destX += destW * (offsetX || 0)
  destY += +destH * (offsetY || 0)

  const clipH = clipY ? Math.max(0, destY + destH - clipY) : 0
  if (clipH < destH)
    ctx.drawImage(
      sprites,
      sprite.x,
      sprite.y,
      sprite.w,
      sprite.h - (sprite.h * clipH) / destH,
      destX,
      destY,
      destW,
      destH - clipH
    )
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  width: number,
  resolution: number,
  roadWidth: number,
  sprites: CanvasImageSource,
  speedPercent: number,
  scale: number,
  destX: number,
  destY: number,
  steer: number,
  updown: number
) {
  const bounce =
    1.5 * Math.random() * speedPercent * resolution * randomChoice([-1, 1])
  let sprite
  if (steer < 0)
    sprite = updown > 0 ? SPRITES.PLAYER_UPHILL_LEFT : SPRITES.PLAYER_LEFT
  else if (steer > 0)
    sprite = updown > 0 ? SPRITES.PLAYER_UPHILL_RIGHT : SPRITES.PLAYER_RIGHT
  else
    sprite =
      updown > 0 ? SPRITES.PLAYER_UPHILL_STRAIGHT : SPRITES.PLAYER_STRAIGHT

  drawSprite(
    ctx,
    width,
    roadWidth,
    sprites,
    sprite,
    scale,
    destX,
    destY + bounce,
    -0.5,
    -1
  )
}
