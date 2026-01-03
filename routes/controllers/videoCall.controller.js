import { io } from "./socket.js"; // your Socket.IO server instance
import { emailToSocket, socketToEmail } from "./socketMaps.js"; // optional separate file to manage maps

/**
 * Initiate a video call
 * @param req.body { fromEmail, toEmail }
 */
export const initiateCall = (req, res) => {
    try {
        const { fromEmail, toEmail } = req.body;

        const fromSocket = emailToSocket.get(fromEmail);
        const toSocket = emailToSocket.get(toEmail);

        if (!toSocket) {
            return res.status(404).json({ error: "Recipient is offline or not found" });
        }

        // Emit to recipient: incoming call
        io.to(toSocket).emit("incoming:call", { from: fromEmail, socketId: fromSocket });

        res.status(200).json({ message: "Call initiated" });
    } catch (error) {
        console.error("Error initiating call:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Accept a video call
 * @param req.body { fromEmail, toEmail, answer }
 */
export const acceptCall = (req, res) => {
    try {
        const { fromEmail, toEmail, answer } = req.body;

        const fromSocket = emailToSocket.get(fromEmail);
        if (!fromSocket) return res.status(404).json({ error: "Caller not found" });

        io.to(fromSocket).emit("call:accepted", { from: toEmail, answer });

        res.status(200).json({ message: "Call accepted" });
    } catch (error) {
        console.error("Error accepting call:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * End a video call
 * @param req.body { fromEmail, toEmail }
 */
export const endCall = (req, res) => {
    try {
        const { fromEmail, toEmail } = req.body;

        const toSocket = emailToSocket.get(toEmail);
        if (toSocket) {
            io.to(toSocket).emit("call:end", { from: fromEmail });
        }

        res.status(200).json({ message: "Call ended" });
    } catch (error) {
        console.error("Error ending call:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};
