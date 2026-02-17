
// // socket.js
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
//             "https://vizit-homes-k2n7.onrender.com"
//         ],
//         credentials: true,
//     },
//     transports: ["websocket", "polling"],
// });

// /**
//  * userSocketMap: Map<userId, Set<socketId>>
//  */
// const userSocketMap = new Map();

// export function getReceiverSocketId(userId) {
//     const set = userSocketMap.get(userId);
//     if (!set) return [];
//     return Array.from(set);
// }

// io.on("connection", (socket) => {
//     console.log("✅ User connected:", socket.id);

//     // Support both handshake.auth (recommended) and handshake.query (older)
//     const userId =
//         socket.handshake?.auth?.userId || socket.handshake?.query?.userId || null;

//     if (userId) {
//         if (!userSocketMap.has(userId)) userSocketMap.set(userId, new Set());
//         userSocketMap.get(userId).add(socket.id);
//     } else {
//         console.warn("Socket connected without userId:", socket.id);
//     }

//     // Broadcast online users (array of userIds)
//     io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));

//     // Simple pass-through message event if you want to use socket->server->db route
//     // socket.on("sendMessage", (payload) => {
//     //     // optional: validate payload, save to DB etc.
//     //     // then broadcast to receiver
//     //     const { message } = payload || {};
//     //     if (!message) return;
//     //     const toUserId = message.receiverId;
//     //     const sockets = getReceiverSocketId(toUserId);
//     //     sockets.forEach((sockId) => io.to(sockId).emit("newMessage", message));
//     // });

//     socket.on("sendMessage", (payload) => {
//         if (!payload || !payload.message) return;

//         const { message } = payload;
//         const { receiverId, senderId, _id: messageId } = message;

//         if (!receiverId || !senderId || !messageId) return;

//         const receiverSocketIds = getReceiverSocketId(receiverId);

//         if (!Array.isArray(receiverSocketIds)) return;

//         receiverSocketIds.forEach((socketId) => {
//             // 🚫 prevent echoing message back to sender socket
//             if (socketId !== socket.id) {
//                 io.to(socketId).emit("newMessage", message);
//             }
//         });
//     });



//     socket.on("markMessagesRead", async ({ chatUserId, readerId }) => {
//         // 1️⃣ Update DB
//         const result = await Message.updateMany(
//             {
//                 senderId: chatUserId,
//                 receiverId: readerId,
//                 readistrue: false
//             },
//             { $set: { readistrue: true } }
//         );

//         // 2️⃣ Notify sender
//         const senderSocket = onlineUsers.get(chatUserId);
//         if (senderSocket) {
//             io.to(senderSocket).emit("messagesRead", {
//                 byUserId: readerId,
//                 chatUserId
//             });
//         }
//     });

//     /** Peer/call events (unchanged but robust) **/
//     socket.on("user:call", ({ toUserId, offer }) => {
//         const receiverSockets = getReceiverSocketId(toUserId);
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
//         receiverSockets.forEach((toSocketId) => {
//             io.to(toSocketId).emit("ice-candidate", {
//                 fromUserId: userId,
//                 candidate,
//             });
//         });
//     });

//     socket.on("call:end", ({ toUserId, roomId }) => {
//         const receiverSockets = getReceiverSocketId(toUserId);
//         receiverSockets.forEach((toSocketId) => {
//             io.to(toSocketId).emit("call:end", {
//                 fromUserId: userId,
//                 roomId,
//             });
//         });
//     });

//     socket.on("disconnect", () => {
//         console.log("❌ User disconnected:", socket.id);
//         if (userId && userSocketMap.has(userId)) {
//             const sockets = userSocketMap.get(userId);
//             sockets.delete(socket.id);
//             if (sockets.size === 0) userSocketMap.delete(userId);
//         }
//         io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
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
            "https://vizithomes.vercel.app",
            "http://localhost:5173",
            "http://localhost:5174",
            "https://vizit-seven.vercel.app",
            "https://wicichats.vercel.app",
            "https://vizit-homes-k2n7.onrender.com",
            "https://www.vizit.homes",
            "http://169.254.237.117:8080",
            "http://localhost:8080",
            "http://192.168.43.221:8080",
            "https://dashboard.vizit.homes",

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



    socket.on("markMessagesRead", ({ chatUserId, readerId }) => {
        if (!chatUserId || !readerId) return;

        // Notify the sender (all their active sockets)
        const senderSockets = getReceiverSocketId(chatUserId) || [];

        senderSockets.forEach((socketId) => {
            io.to(socketId).emit("messagesRead", {
                byUserId: readerId,
                chatUserId
            });
        });
    });


    socket.on("registerUser", (userId) => {
        socket.userId = userId;
        socket.join(userId); // join room with own user ID
    });
    // listen for typing event
    socket.on("typing", ({ chatUserId, isTyping }) => {

        // emit to the other user only
        socket.to(chatUserId).emit("typingStatus", { byUserId: socket.userId, isTyping });

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
