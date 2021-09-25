import WebSocket, { Server } from 'ws'
import { CarPositionMessage } from '../../common/'

interface Client {
  id: number
  socket: WebSocket
  offset: number
  z: number
}
let clients: Client[] = []
const wss = new Server({
  port: 8080
})

wss.on('connection', (socket) => {
  const id = Math.round(Math.random() * 1000000)
  const me = { id, socket, offset: 0, z: 0 }
  clients.push(me)
  console.log(`${id} got connected`)

  socket.onclose = () => {
    clients = clients.filter((car) => car.id !== id)

    console.log(`${id} got disconnected`)
  }
  socket.addEventListener('message', ({ data }) => {
    const parsed = JSON.parse(data)
    if ('offset' in parsed && 'z' in parsed) {
      me.offset = parsed.offset
      me.z = parsed.z
    }
  })
})

// 60fps network updates
const RATE = (1 / 60) * 1000

const emitPositions = () => {
  for (const client of clients) {
    const msg = JSON.stringify({
      cars: clients
        .filter((c) => c.id !== client.id)
        .map(({ id, offset, z }) => ({ id, offset, z }))
    })
    client.socket.send(msg)
  }
  setTimeout(emitPositions, RATE)
}
emitPositions()
