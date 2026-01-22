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
//         { name: "video", maxCount: 1 },
//     ]),
//     async (req, res) => {
//         try {
//             const { id: receiverId } = req.params;
//             // Prefer authenticated user id (req.user), fallback to body
//             const senderId = req.user?._id?.toString() || req.body.senderId;

//             if (!senderId || !receiverId)
//                 return res.status(400).json({ error: "senderId and receiverId required" });

//             const { text = "" } = req.body;

//             let imageUrl = null;
//             let videoUrl = null;

//             if (req.files?.image?.[0]) {
//                 imageUrl = await new Promise((resolve, reject) => {
//                     const stream = cloudinary.uploader.upload_stream({ resource_type: "image" }, (err, result) =>
//                         err ? reject(err) : resolve(result.secure_url)
//                     );
//                     stream.end(req.files.image[0].buffer);
//                 });
//             }

//             if (req.files?.video?.[0]) {
//                 videoUrl = await new Promise((resolve, reject) => {
//                     const stream = cloudinary.uploader.upload_stream({ resource_type: "video" }, (err, result) =>
//                         err ? reject(err) : resolve(result.secure_url)
//                     );
//                     stream.end(req.files.video[0].buffer);
//                 });
//             }

//             const newMessage = new Message({
//                 senderId,
//                 receiverId,
//                 text,
//                 image: imageUrl,
//                 video: videoUrl,
//             });

//             await newMessage.save();

//             // Emit to receiver(s)
//             const receiverSockets = getReceiverSocketId(receiverId);
//             receiverSockets.forEach((sockId) => io.to(sockId).emit("newMessage", newMessage));

//             // Echo to sender's other sockets (so the sender's other tabs/devices also receive it)
//             const senderSockets = getReceiverSocketId(senderId);
//             senderSockets.forEach((sockId) => io.to(sockId).emit("newMessage", newMessage));

//             return res.status(201).json(newMessage);
//         } catch (error) {
//             console.error("Error in sendMessage:", error);
//             return res.status(500).json({ error: "Internal Server Error" });
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
            const senderId = req.user?._id?.toString() || req.body.senderId;

            if (!senderId || !receiverId) {
                return res.status(400).json({ error: "senderId and receiverId required" });
            }

            const { text = "" } = req.body;

            let imageUrl = null;
            let videoUrl = null;

            if (req.files?.image?.[0]?.buffer) {
                imageUrl = await new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream(
                        { resource_type: "image" },
                        (err, result) => err ? reject(err) : resolve(result.secure_url)
                    ).end(req.files.image[0].buffer);
                });
            }

            if (req.files?.video?.[0]?.buffer) {
                videoUrl = await new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream(
                        { resource_type: "video" },
                        (err, result) => err ? reject(err) : resolve(result.secure_url)
                    ).end(req.files.video[0].buffer);
                });
            }

            const newMessage = new Message({
                senderId,
                receiverId,
                text,
                image: imageUrl,
                video: videoUrl,
                readistrue: false
            });

            await newMessage.save();

            const receiverSockets = getReceiverSocketId(receiverId) || [];
            receiverSockets.forEach(id => io.to(id).emit("newMessage", newMessage));

            const senderSockets = getReceiverSocketId(senderId) || [];
            senderSockets.forEach(id => io.to(id).emit("newMessage", newMessage));

            res.status(201).json(newMessage);
        } catch (error) {
            console.error("SEND MESSAGE ERROR:", error);
            res.status(500).json({ error: error.message });
        }
    }
];
