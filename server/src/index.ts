import geckos from '@geckos.io/server'
const io = geckos<{
  'car position': number
}>()

io.listen()

io.onConnection((channel) => {
  channel.onDisconnect(() => {
    console.log(`${channel.id} got disconnected`)
  })

  channel.on('car position', (data) => {
    console.log(`got ${data} from "car position"`)
    io.room(channel.roomId).emit('car position', data)
  })
})
