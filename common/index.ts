export interface CarPosition {
  offset: number
  z: number
}
export interface CarPositionMessage {
  id: number
  position: { offset: number; z: number }
}

export interface JoinServer {
  id: number
}

export interface CarsList {
  ids: number[]
}
