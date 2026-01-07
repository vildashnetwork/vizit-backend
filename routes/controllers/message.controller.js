import cloudinary from "../cloudinary.js";
import { getReceiverSocketId } from "../../socket.js";
import { io } from "../../socket.js"
import Message from "../../models/message.model.js";
import UserModel from "../../models/Users.js";
import HouseOwerModel from "../../models/HouseOwners.js";
import { upload } from '../multerConfig.js';
export const getUsersForSidebar = async (req, res) => {
    try {
        const { loggedInUserId } = req.params;
        const filteredUsers = await UserModel.find({ _id: { $ne: loggedInUserId } }).select('-password');
        const filteredOwners = await HouseOwerModel.find({ _id: { $ne: loggedInUserId } }).select('-password');
        if (!filteredUsers || !filteredOwners) {
            return res.status(404).json({ message: "No users found" });
        }
        res.status(200).json({ filteredUsers, filteredOwners });
    } catch (error) {
        console.log("Error in getUsersForSidebar: ", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
}


export const getMessages = async (req, res) => {
    try {
        const { id: userToChatId } = req.params;
        const { myId } = req.query;

        if (!myId) {
            return res.status(400).json({ error: "myId is required" });
        }

        const messages = await Message.find({
            $or: [
                { senderId: myId, receiverId: userToChatId },
                { senderId: userToChatId, receiverId: myId }
            ]
        }).sort({ createdAt: 1 });

        res.status(200).json(messages);
    } catch (error) {
        console.log("Error in getMessages:", error.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

















// export const sendMessage = [
//     upload.fields([
//         { name: "image", maxCount: 1 },
//         { name: "video", maxCount: 1 }
//     ]),
//     async (req, res) => {
//         try {
//             const { id: receiverId } = req.params;
//             const { senderId, text } = req.body;

//             let imageUrl = null;
//             let videoUrl = null;

//             // Handle image upload
//             if (req.files?.image?.[0]) {
//                 imageUrl = await new Promise((resolve, reject) => {
//                     const stream = cloudinary.uploader.upload_stream(
//                         { resource_type: "image" },
//                         (error, result) => {
//                             if (error) return reject(error);
//                             resolve(result.secure_url);
//                         }
//                     );
//                     stream.end(req.files.image[0].buffer);
//                 });
//             }

//             // Handle video upload
//             if (req.files?.video?.[0]) {
//                 videoUrl = await new Promise((resolve, reject) => {
//                     const stream = cloudinary.uploader.upload_stream(
//                         { resource_type: "video" },
//                         (error, result) => {
//                             if (error) return reject(error);
//                             resolve(result.secure_url);
//                         }
//                     );
//                     stream.end(req.files.video[0].buffer);
//                 });
//             }

//             const newMessage = new Message({
//                 senderId,
//                 receiverId,
//                 text,
//                 image: imageUrl,
//                 video: videoUrl
//             });

//             await newMessage.save();

//             // Real-time messaging
//             const receiverSocketId = getReceiverSocketId(receiverId);
//             if (receiverSocketId) {
//                 io.to(receiverSocketId).emit("newMessage", newMessage);
//             }

//             res.status(201).json(newMessage);
//         } catch (error) {
//             console.error("Error in sendMessage:", error.message);
//             res.status(500).json({ error: "Internal Server Error" });
//         }
//     },
// ];














export const sendMessage = [
    upload.fields([
        { name: "image", maxCount: 1 },
        { name: "video", maxCount: 1 },
    ]),

    async (req, res) => {
        try {
            const { id: receiverId } = req.params;
            const { senderId, text = "" } = req.body;

            if (!senderId || !receiverId) {
                return res.status(400).json({ error: "senderId and receiverId required" });
            }

            if (!text && !req.files?.image && !req.files?.video) {
                return res.status(400).json({ error: "Message content is empty" });
            }

            let imageUrl = null;
            let videoUrl = null;

            /* ================= IMAGE UPLOAD ================= */
            if (req.files?.image?.[0]) {
                imageUrl = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { resource_type: "image" },
                        (error, result) => {
                            if (error) return reject(error);
                            resolve(result.secure_url);
                        }
                    );
                    stream.end(req.files.image[0].buffer);
                });
            }

            /* ================= VIDEO UPLOAD ================= */
            if (req.files?.video?.[0]) {
                videoUrl = await new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { resource_type: "video" },
                        (error, result) => {
                            if (error) return reject(error);
                            resolve(result.secure_url);
                        }
                    );
                    stream.end(req.files.video[0].buffer);
                });
            }

            /* ================= SAVE MESSAGE ================= */
            const newMessage = new Message({
                senderId,
                receiverId,
                text,
                image: imageUrl,
                video: videoUrl,
            });

            await newMessage.save();

            /* ================= REAL-TIME DELIVERY ================= */

            const receiverSockets = getReceiverSocketId(receiverId);
            const senderSockets = getReceiverSocketId(senderId);

            // Send to receiver (all devices)
            receiverSockets?.forEach((socketId) => {
                io.to(socketId).emit("newMessage", newMessage);
            });

            // Echo to sender (other tabs/devices)
            senderSockets?.forEach((socketId) => {
                io.to(socketId).emit("newMessage", newMessage);
            });

            res.status(201).json(newMessage);
        } catch (error) {
            console.error("❌ Error in sendMessage:", error);
            res.status(500).json({ error: "Internal Server Error" });
        }
    },
];