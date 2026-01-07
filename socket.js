// import { Server } from 'socket.io';
// import { createServer } from 'http';
// import express from 'express';
// import cors from 'cors';

// const app = express();
// app.use(cors());

// const httpServer = createServer(app);

// const io = new Server(httpServer, {

//     cors: {
//         origin: [
//             "http://localhost:5173",
//             "http://localhost:5174",
//             "https://vizit-seven.vercel.app",
//             "https://wicichats.vercel.app"
//         ]
//     }
// });


// // Store online users { userId: socketId }
// const userSocketMap = {};

// // Helper to get socket id
// export function getReceiverSocketId(userId) {
//     return userSocketMap[userId];
// }

// io.on('connection', (socket) => {
//     console.log('A user connected', socket.id);

//     const userId = socket.handshake.query.userId;
//     if (userId) userSocketMap[userId] = socket.id;

//     // Broadcast online users to all clients
//     io.emit('getOnlineUsers', Object.keys(userSocketMap));

//     /** ==================== CALL EVENTS ==================== **/

//     // User A initiates a call to User B
//     socket.on('user:call', ({ toUserId, offer }) => {
//         const toSocketId = getReceiverSocketId(toUserId);
//         if (toSocketId) {
//             // Auto-generate a room
//             const roomId = [socket.id, toSocketId].sort().join('-');
//             socket.join(roomId);

//             io.to(toSocketId).emit('incoming:call', {
//                 fromUserId: userId,
//                 offer,
//                 roomId
//             });
//         }
//     });

//     // User B accepts the call
//     socket.on('call:accepted', ({ toUserId, answer, roomId }) => {
//         const toSocketId = getReceiverSocketId(toUserId);
//         if (toSocketId) {
//             io.to(toSocketId).emit('call:accepted', {
//                 fromUserId: userId,
//                 answer,
//                 roomId
//             });
//         }
//     });

//     // Handle peer negotiation (ICE candidates)
//     socket.on('peer:nego:needed', ({ toUserId, offer, roomId }) => {
//         const toSocketId = getReceiverSocketId(toUserId);
//         if (toSocketId) {
//             io.to(toSocketId).emit('peer:nego:needed', {
//                 fromUserId: userId,
//                 offer,
//                 roomId
//             });
//         }
//     });

//     socket.on('peer:nego:done', ({ toUserId, answer, roomId }) => {
//         const toSocketId = getReceiverSocketId(toUserId);
//         if (toSocketId) {
//             io.to(toSocketId).emit('peer:nego:final', {
//                 fromUserId: userId,
//                 answer,
//                 roomId
//             });
//         }
//     });

//     // Send ICE candidates
//     socket.on('ice-candidate', ({ toUserId, candidate }) => {
//         const toSocketId = getReceiverSocketId(toUserId);
//         if (toSocketId) {
//             io.to(toSocketId).emit('ice-candidate', {
//                 fromUserId: userId,
//                 candidate
//             });
//         }
//     });

//     // End call
//     socket.on('call:end', ({ toUserId, roomId }) => {
//         const toSocketId = getReceiverSocketId(toUserId);
//         if (toSocketId) {
//             io.to(toSocketId).emit('call:end', { fromUserId: userId, roomId });
//         }
//     });

//     /** ===================================================== **/

//     socket.on('disconnect', () => {
//         console.log('A user disconnected', socket.id);
//         delete userSocketMap[userId];
//         io.emit('getOnlineUsers', Object.keys(userSocketMap));
//     });
// });

// export { app, io, httpServer };






// socket.js
import { Server } from "socket.io";
import { createServer } from "http";
import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: [
            "http://localhost:5173",
            "http://localhost:5174",
            "https://vizit-seven.vercel.app",
            "https://wicichats.vercel.app",
        ],
        credentials: true,
    },
    transports: ["websocket", "polling"],
});

/**
 * userSocketMap: Map<userId, Set<socketId>>
 */
const userSocketMap = new Map();

export function getReceiverSocketId(userId) {
    const set = userSocketMap.get(userId);
    if (!set) return [];
    return Array.from(set);
}

io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);

    // Support both handshake.auth (recommended) and handshake.query (older)
    const userId =
        socket.handshake?.auth?.userId || socket.handshake?.query?.userId || null;

    if (userId) {
        if (!userSocketMap.has(userId)) userSocketMap.set(userId, new Set());
        userSocketMap.get(userId).add(socket.id);
    } else {
        console.warn("Socket connected without userId:", socket.id);
    }

    // Broadcast online users (array of userIds)
    io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));

    // Simple pass-through message event if you want to use socket->server->db route
    // socket.on("sendMessage", (payload) => {
    //     // optional: validate payload, save to DB etc.
    //     // then broadcast to receiver
    //     const { message } = payload || {};
    //     if (!message) return;
    //     const toUserId = message.receiverId;
    //     const sockets = getReceiverSocketId(toUserId);
    //     sockets.forEach((sockId) => io.to(sockId).emit("newMessage", message));
    // });

    socket.on("sendMessage", (payload) => {
        if (!payload || !payload.message) return;

        const { message } = payload;
        const { receiverId, senderId, _id: messageId } = message;

        if (!receiverId || !senderId || !messageId) return;

        const receiverSocketIds = getReceiverSocketId(receiverId);

        if (!Array.isArray(receiverSocketIds)) return;

        receiverSocketIds.forEach((socketId) => {
            // 🚫 prevent echoing message back to sender socket
            if (socketId !== socket.id) {
                io.to(socketId).emit("newMessage", message);
            }
        });
    });



    /** Peer/call events (unchanged but robust) **/
    socket.on("user:call", ({ toUserId, offer }) => {
        const receiverSockets = getReceiverSocketId(toUserId);
        receiverSockets.forEach((toSocketId) => {
            const roomId = [socket.id, toSocketId].sort().join("-");
            socket.join(roomId);
            io.to(toSocketId).emit("incoming:call", {
                fromUserId: userId,
                offer,
                roomId,
            });
        });
    });

    socket.on("call:accepted", ({ toUserId, answer, roomId }) => {
        const receiverSockets = getReceiverSocketId(toUserId);
        receiverSockets.forEach((toSocketId) => {
            io.to(toSocketId).emit("call:accepted", {
                fromUserId: userId,
                answer,
                roomId,
            });
        });
    });

    socket.on("peer:nego:needed", ({ toUserId, offer, roomId }) => {
        const receiverSockets = getReceiverSocketId(toUserId);
        receiverSockets.forEach((toSocketId) => {
            io.to(toSocketId).emit("peer:nego:needed", {
                fromUserId: userId,
                offer,
                roomId,
            });
        });
    });

    socket.on("peer:nego:done", ({ toUserId, answer, roomId }) => {
        const receiverSockets = getReceiverSocketId(toUserId);
        receiverSockets.forEach((toSocketId) => {
            io.to(toSocketId).emit("peer:nego:final", {
                fromUserId: userId,
                answer,
                roomId,
            });
        });
    });

    socket.on("ice-candidate", ({ toUserId, candidate }) => {
        const receiverSockets = getReceiverSocketId(toUserId);
        receiverSockets.forEach((toSocketId) => {
            io.to(toSocketId).emit("ice-candidate", {
                fromUserId: userId,
                candidate,
            });
        });
    });

    socket.on("call:end", ({ toUserId, roomId }) => {
        const receiverSockets = getReceiverSocketId(toUserId);
        receiverSockets.forEach((toSocketId) => {
            io.to(toSocketId).emit("call:end", {
                fromUserId: userId,
                roomId,
            });
        });
    });

    socket.on("disconnect", () => {
        console.log("❌ User disconnected:", socket.id);
        if (userId && userSocketMap.has(userId)) {
            const sockets = userSocketMap.get(userId);
            sockets.delete(socket.id);
            if (sockets.size === 0) userSocketMap.delete(userId);
        }
        io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
    });
});

export { app, io, httpServer };
