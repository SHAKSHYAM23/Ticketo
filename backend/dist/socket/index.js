import { Server } from 'socket.io';
let io;
const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL ?? 'http://localhost:3001',
            methods: ['GET', 'POST']
        }
    });
    io.on('connection', (socket) => {
        // console.log(`User connected: ${socket.id}`)
        socket.on('join_event', (eventId) => {
            socket.join(`event:${eventId}`);
            // console.log(`Socket ${socket.id} joined room: event:${eventId}`)
        });
        socket.on('leave_event', (eventId) => {
            socket.leave(`event:${eventId}`);
            // console.log(`Socket ${socket.id} left room: event:${eventId}`)
        });
        socket.on('disconnect', () => {
            // console.log(`User disconnected: ${socket.id}`)
        });
    });
};
const getIO = () => {
    if (!io)
        throw new Error('Socket.io not initialized');
    return io;
};
export { initSocket, getIO };
