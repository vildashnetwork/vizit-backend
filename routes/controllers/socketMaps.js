// socketMaps.js

// Map: email -> socketId
export const emailToSocket = new Map();

// Map: socketId -> email
export const socketToEmail = new Map();

/**
 * Register a connected user
 * @param {string} email
 * @param {string} socketId
 */
export const registerUserSocket = (email, socketId) => {
    emailToSocket.set(email, socketId);
    socketToEmail.set(socketId, email);
};

/**
 * Remove user on disconnect
 * @param {string} socketId
 */
export const removeUserSocket = (socketId) => {
    const email = socketToEmail.get(socketId);
    if (email) {
        emailToSocket.delete(email);
    }
    socketToEmail.delete(socketId);
};

/**
 * Get socketId by email
 * @param {string} email
 * @returns {string | undefined}
 */
export const getSocketIdByEmail = (email) => {
    return emailToSocket.get(email);
};
