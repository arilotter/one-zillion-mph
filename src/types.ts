export interface Position {
  world: { x: number; y: number; z: number }
  camera: { x: number; y: number; z: number }
  screen: { x: number; y: number; w: number; scale: number }
}

export interface Sprite {
  x: number
  y: number
  w: number
  h: number
}
