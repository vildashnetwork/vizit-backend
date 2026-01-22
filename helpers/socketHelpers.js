import { io } from "../socket.js";
import { userSocketMap } from "../socket.js";

export function emitToUser(userId, event, payload) {
    const sockets = userSocketMap.get(userId);
    if (!sockets) return;

    sockets.forEach(socketId => {
        io.to(socketId).emit(event, payload);
    });
}
