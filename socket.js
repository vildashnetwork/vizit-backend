// import { Server } from 'socket.io';
// import { createServer } from 'http';
// import express from 'express';

// const app = express();

// const httpServer = createServer(app);

// const io = new Server(httpServer, {
//     cors: {
//         origin: ["http://localhost:5173", "http://localhost:5174", "https://vizit-seven.vercel.app", "https://wicichats.vercel.app"]
//     }
// });

// export function getReceiverSocketId(userId) {
//     return userSocketMap[userId];
// }

// // used to store online users
// const userSocketMap = {}  // {userId: socketId}


// io.on('connection', (socket) => {
//     console.log('A user connected', socket.id);

//     const userId = socket.handshake.query.userId;
//     if (userId) userSocketMap[userId] = socket.id;

//     // io.emit is used to send events to all connected clients..(send online users to all clients)
//     io.emit('getOnlineUsers', Object.keys(userSocketMap));

//     socket.on('disconnect', () => {
//         console.log('A user disconnected');
//         delete userSocketMap[userId];
//         io.emit('getOnlineUsers', Object.keys(userSocketMap));
//     })

// })

// export { app, io, httpServer };




import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';

const app = express();
app.use((req, res, next) => {
    const allowedOrigins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "https://vizit-seven.vercel.app"
    ];
    const origin = req.headers.origin;

    if (allowedOrigins.includes(origin)) {
        // This explicitly sets the origin instead of '*'
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    // Handle the Preflight (OPTIONS) request immediately
    if (req.method === 'OPTIONS') {
        return res.status(200).json({});
    }

    next();
});

const httpServer = createServer(app);

const io = new Server(httpServer, {

    cors: {
        origin: [
            "http://localhost:5173",
            "http://localhost:5174",
            "https://vizit-seven.vercel.app",
            "https://wicichats.vercel.app"
        ]
    }
});


// Store online users { userId: socketId }
const userSocketMap = {};

// Helper to get socket id
export function getReceiverSocketId(userId) {
    return userSocketMap[userId];
}

io.on('connection', (socket) => {
    console.log('A user connected', socket.id);

    const userId = socket.handshake.query.userId;
    if (userId) userSocketMap[userId] = socket.id;

    // Broadcast online users to all clients
    io.emit('getOnlineUsers', Object.keys(userSocketMap));

    /** ==================== CALL EVENTS ==================== **/

    // User A initiates a call to User B
    socket.on('user:call', ({ toUserId, offer }) => {
        const toSocketId = getReceiverSocketId(toUserId);
        if (toSocketId) {
            // Auto-generate a room
            const roomId = [socket.id, toSocketId].sort().join('-');
            socket.join(roomId);

            io.to(toSocketId).emit('incoming:call', {
                fromUserId: userId,
                offer,
                roomId
            });
        }
    });

    // User B accepts the call
    socket.on('call:accepted', ({ toUserId, answer, roomId }) => {
        const toSocketId = getReceiverSocketId(toUserId);
        if (toSocketId) {
            io.to(toSocketId).emit('call:accepted', {
                fromUserId: userId,
                answer,
                roomId
            });
        }
    });

    // Handle peer negotiation (ICE candidates)
    socket.on('peer:nego:needed', ({ toUserId, offer, roomId }) => {
        const toSocketId = getReceiverSocketId(toUserId);
        if (toSocketId) {
            io.to(toSocketId).emit('peer:nego:needed', {
                fromUserId: userId,
                offer,
                roomId
            });
        }
    });

    socket.on('peer:nego:done', ({ toUserId, answer, roomId }) => {
        const toSocketId = getReceiverSocketId(toUserId);
        if (toSocketId) {
            io.to(toSocketId).emit('peer:nego:final', {
                fromUserId: userId,
                answer,
                roomId
            });
        }
    });

    // Send ICE candidates
    socket.on('ice-candidate', ({ toUserId, candidate }) => {
        const toSocketId = getReceiverSocketId(toUserId);
        if (toSocketId) {
            io.to(toSocketId).emit('ice-candidate', {
                fromUserId: userId,
                candidate
            });
        }
    });

    // End call
    socket.on('call:end', ({ toUserId, roomId }) => {
        const toSocketId = getReceiverSocketId(toUserId);
        if (toSocketId) {
            io.to(toSocketId).emit('call:end', { fromUserId: userId, roomId });
        }
    });

    /** ===================================================== **/

    socket.on('disconnect', () => {
        console.log('A user disconnected', socket.id);
        delete userSocketMap[userId];
        io.emit('getOnlineUsers', Object.keys(userSocketMap));
    });
});

export { app, io, httpServer };
