export interface CarPosition {
  id: number
  position: { offset: number; z: number }
}

export interface JoinServer {
  id: number
}

export interface CarsList {
  ids: number[]
}

export interface Messages {
  car_position: CarPosition
  join_server: JoinServer
  cars_list: CarsList
}
