import { Server, type Socket } from 'socket.io'
import type { Server as HTTPServer } from 'http'


let io: Server

const initSocket = (httpServer: HTTPServer): void => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
      methods: ['GET', 'POST']
    }
  })

  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`)


    socket.on('join_event', (eventId: string) => {
      socket.join(`event:${eventId}`)
      console.log(`👤 Socket ${socket.id} joined room: event:${eventId}`)
    })

    socket.on('leave_event', (eventId: string) => {
      socket.leave(`event:${eventId}`)
      console.log(` Socket ${socket.id} left room: event:${eventId}`)
    })

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`)
    })
  })

  console.log(' Socket.io initialized')
}


const getIO = (): Server => {
  if (!io) throw new Error('Socket.io not initialized. Call initSocket first.')
  return io
}

export { initSocket, getIO }