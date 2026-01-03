// socket.js (video calls only)
import { Server } from "socket.io";
import { createServer } from "http";
import express from "express";
import {
    registerUserSocket,
    removeUserSocket,
    getSocketIdByEmail
} from "./socketMaps.js";

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
    cors: {
        origin: [
            "http://localhost:5173",
            "http://localhost:5174",
            "https://wicikis.vercel.app",
            "https://wicichats.vercel.app"
        ],
        methods: ["GET", "POST"]
    }
});

/**
 * SOCKET CONNECTION
 * Each client MUST connect with:
 * io(SERVER_URL, { query: { email } })
 */
io.on("connection", (socket) => {
    const email = socket.handshake.query.email;

    if (!email) {
        console.warn("Socket connected without email:", socket.id);
        socket.disconnect();
        return;
    }

    registerUserSocket(email, socket.id);
    console.log(`📞 Call socket connected: ${email} → ${socket.id}`);

    // --- OPTIONAL: SOCKET-ONLY CALL EVENTS (backup / real-time) ---

    socket.on("call:initiate", ({ toEmail }) => {
        const toSocket = getSocketIdByEmail(toEmail);
        if (toSocket) {
            io.to(toSocket).emit("incoming:call", { fromEmail: email });
        }
    });

    socket.on("call:accept", ({ toEmail, answer }) => {
        const toSocket = getSocketIdByEmail(toEmail);
        if (toSocket) {
            io.to(toSocket).emit("call:accepted", {
                fromEmail: email,
                answer
            });
        }
    });

    socket.on("call:end", ({ toEmail }) => {
        const toSocket = getSocketIdByEmail(toEmail);
        if (toSocket) {
            io.to(toSocket).emit("call:end", { fromEmail: email });
        }
    });

    socket.on("disconnect", () => {
        removeUserSocket(socket.id);
        console.log(`📴 Call socket disconnected: ${email}`);
    });
});

export { app, httpServer };
