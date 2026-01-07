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





















// import { Server } from "socket.io";
// import { createServer } from "http";
// import express from "express";
// import cors from "cors";

// const app = express();
// app.use(cors());

// const httpServer = createServer(app);

// const io = new Server(httpServer, {
//     cors: {
//         origin: [
//             "http://localhost:5173",
//             "http://localhost:5174",
//             "https://vizit-seven.vercel.app",
//             "https://wicichats.vercel.app",
//         ],
//         credentials: true,
//     },
// });

// /**
//  * Store online users
//  * {
//  *   userId: Set(socketId)
//  * }
//  */
// const userSocketMap = new Map();

// /**
//  * Get ALL socket IDs for a user
//  */
// export function getReceiverSocketId(userId) {
//     return userSocketMap.get(userId);
// }

// io.on("connection", (socket) => {
//     console.log("✅ User connected:", socket.id);

//     const userId = socket.handshake.query.userId;

//     if (userId) {
//         if (!userSocketMap.has(userId)) {
//             userSocketMap.set(userId, new Set());
//         }
//         userSocketMap.get(userId).add(socket.id);
//     }

//     // Broadcast online users
//     io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));

//     /** ==================== CALL EVENTS ==================== **/

//     socket.on("user:call", ({ toUserId, offer }) => {
//         const receiverSockets = getReceiverSocketId(toUserId);

//         if (!receiverSockets) return;

//         receiverSockets.forEach((toSocketId) => {
//             const roomId = [socket.id, toSocketId].sort().join("-");
//             socket.join(roomId);

//             io.to(toSocketId).emit("incoming:call", {
//                 fromUserId: userId,
//                 offer,
//                 roomId,
//             });
//         });
//     });

//     socket.on("call:accepted", ({ toUserId, answer, roomId }) => {
//         const receiverSockets = getReceiverSocketId(toUserId);

//         if (!receiverSockets) return;

//         receiverSockets.forEach((toSocketId) => {
//             io.to(toSocketId).emit("call:accepted", {
//                 fromUserId: userId,
//                 answer,
//                 roomId,
//             });
//         });
//     });

//     socket.on("peer:nego:needed", ({ toUserId, offer, roomId }) => {
//         const receiverSockets = getReceiverSocketId(toUserId);

//         if (!receiverSockets) return;

//         receiverSockets.forEach((toSocketId) => {
//             io.to(toSocketId).emit("peer:nego:needed", {
//                 fromUserId: userId,
//                 offer,
//                 roomId,
//             });
//         });
//     });

//     socket.on("peer:nego:done", ({ toUserId, answer, roomId }) => {
//         const receiverSockets = getReceiverSocketId(toUserId);

//         if (!receiverSockets) return;

//         receiverSockets.forEach((toSocketId) => {
//             io.to(toSocketId).emit("peer:nego:final", {
//                 fromUserId: userId,
//                 answer,
//                 roomId,
//             });
//         });
//     });

//     socket.on("ice-candidate", ({ toUserId, candidate }) => {
//         const receiverSockets = getReceiverSocketId(toUserId);

//         if (!receiverSockets) return;

//         receiverSockets.forEach((toSocketId) => {
//             io.to(toSocketId).emit("ice-candidate", {
//                 fromUserId: userId,
//                 candidate,
//             });
//         });
//     });

//     socket.on("call:end", ({ toUserId, roomId }) => {
//         const receiverSockets = getReceiverSocketId(toUserId);

//         if (!receiverSockets) return;

//         receiverSockets.forEach((toSocketId) => {
//             io.to(toSocketId).emit("call:end", {
//                 fromUserId: userId,
//                 roomId,
//             });
//         });
//     });

//     /** ===================================================== **/

//     socket.on("disconnect", () => {
//         console.log("❌ User disconnected:", socket.id);

//         if (userId && userSocketMap.has(userId)) {
//             const sockets = userSocketMap.get(userId);
//             sockets.delete(socket.id);

//             if (sockets.size === 0) {
//                 userSocketMap.delete(userId);
//             }
//         }

//         io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
//     });
// });

// export { app, io, httpServer };
















import { Server } from "socket.io";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import Message from "./models/message.model.js"; // your Mongoose message model

const app = express();
app.use(cors());
app.use(express.json());

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
});

// Store online users: Map<userId, Set<socketId>>
const userSocketMap = new Map();

/**
 * Get all socket IDs for a user
 */
export function getReceiverSocketId(userId) {
    return userSocketMap.get(userId);
}

/**
 * ====================
 * SOCKET.IO CONNECTION
 * ====================
 */
io.on("connection", (socket) => {
    const userId = socket.handshake.auth.userId;
    if (!userId) return;

    console.log("✅ User connected:", userId, socket.id);

    // Add this socket to the user map
    if (!userSocketMap.has(userId)) userSocketMap.set(userId, new Set());
    userSocketMap.get(userId).add(socket.id);

    // Broadcast online users
    io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));

    /** ====================
     * REAL-TIME MESSAGES
     * ==================== */
    socket.on("sendMessage", async ({ senderId, receiverId, text, image, video }) => {
        if (!senderId || !receiverId) return;

        // Save to DB
        const newMessage = await Message.create({
            senderId,
            receiverId,
            text,
            image: image || null,
            video: video || null,
        });

        // Send to receiver (all devices)
        const receiverSockets = getReceiverSocketId(receiverId);
        receiverSockets?.forEach((socketId) => {
            io.to(socketId).emit("newMessage", newMessage);
        });

        // Echo to sender (multi-tab sync)
        const senderSockets = getReceiverSocketId(senderId);
        senderSockets?.forEach((socketId) => {
            io.to(socketId).emit("newMessage", newMessage);
        });
    });

    /** ====================
     * PEER CALL EVENTS
     * ==================== */
    socket.on("user:call", ({ toUserId, offer }) => {
        const receiverSockets = getReceiverSocketId(toUserId);
        if (!receiverSockets) return;

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
        if (!receiverSockets) return;

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
        if (!receiverSockets) return;

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
        if (!receiverSockets) return;

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
        if (!receiverSockets) return;

        receiverSockets.forEach((toSocketId) => {
            io.to(toSocketId).emit("ice-candidate", {
                fromUserId: userId,
                candidate,
            });
        });
    });

    socket.on("call:end", ({ toUserId, roomId }) => {
        const receiverSockets = getReceiverSocketId(toUserId);
        if (!receiverSockets) return;

        receiverSockets.forEach((toSocketId) => {
            io.to(toSocketId).emit("call:end", {
                fromUserId: userId,
                roomId,
            });
        });
    });

    /** ====================
     * DISCONNECT
     * ==================== */
    socket.on("disconnect", () => {
        console.log("❌ User disconnected:", userId, socket.id);

        if (userId && userSocketMap.has(userId)) {
            const sockets = userSocketMap.get(userId);
            sockets.delete(socket.id);
            if (sockets.size === 0) userSocketMap.delete(userId);
        }

        io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
    });
});

export { app, io, httpServer };
