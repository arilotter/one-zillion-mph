import geckos from '@geckos.io/server'

import { Messages } from '../../common'

let cars_list: number[] = []
const io = geckos<Messages>()

io.listen()

io.onConnection((channel) => {
  const newId = (cars_list[cars_list.length - 1] ?? 0) + 1
  cars_list.push(newId)

  channel.emit('cars_list', {
    ids: cars_list
  })

  channel.onDisconnect(() => {
    cars_list = cars_list.filter((car) => car !== newId)

    console.log(`${channel.id} got disconnected`)

    channel.emit('cars_list', {
      ids: cars_list
    })
  })

  channel.on('car_position', (data) => {
    console.log(`got ${data} from "car position"`)
    io.room(channel.roomId).emit('car_position', data)
  })
})
