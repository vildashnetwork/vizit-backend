import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:5174", "https://wicikis.vercel.app", "https://wicichats.vercel.app"]
    }
});

export function getReceiverSocketId(userId) {
    return userSocketMap[userId];
}

// used to store online users
const userSocketMap = {}  // {userId: socketId}


io.on('connection', (socket) => {
    console.log('A user connected', socket.id);

    const userId = socket.handshake.query.userId;
    if (userId) userSocketMap[userId] = socket.id;

    // io.emit is used to send events to all connected clients..(send online users to all clients)
    io.emit('getOnlineUsers', Object.keys(userSocketMap));

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        delete userSocketMap[userId];
        io.emit('getOnlineUsers', Object.keys(userSocketMap));
    })

})

export { app, io, httpServer };













