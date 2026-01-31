

import express from "express";
import Reels from "../models/Reels.js";
import { io } from "../socket.js";
const router = express.Router();



// POST REEL
router.post("/post/reel", async (req, res) => {
    try {
        const {
            username,
            postownerId,
            caption,
            videoUrl,
            avatar,
            email
        } = req.body;

        if (!username || !postownerId || !caption || !videoUrl || !avatar || !email) {
            return res.status(400).json({
                message: "All required fields must be provided"
            });
        }

        const savedata = new Reels({
            username,
            postownerId,
            caption,
            videoUrl,
            avatar,
            email
        });

        const savedReel = await savedata.save();
        io.emit("reel:new", {
            reel: savedReel
        });
        return res.status(201).json({
            message: "Reel posted successfully",
            reel: savedReel
        });

    } catch (error) {
        console.error("POST REEL ERROR:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
});


// GET ALL REELS (latest first)
router.get("/reels", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const reels = await Reels.find()
            .sort({ createdAt: -1 })   // newest first
            .skip(skip)
            .limit(limit);

        const totalReels = await Reels.countDocuments();

        return res.status(200).json({
            page,
            limit,
            totalReels,
            totalPages: Math.ceil(totalReels / limit),
            reels
        });

    } catch (error) {
        console.error("GET REELS ERROR:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
});



// DELETE REEL
router.delete("/reel/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { postownerId } = req.body; // send from frontend (or use auth middleware)

        const reel = await Reels.findById(id);

        if (!reel) {
            return res.status(404).json({
                message: "Reel not found"
            });
        }

        // Authorization check
        if (reel.postownerId.toString() !== postownerId) {
            return res.status(403).json({
                message: "You are not allowed to delete this reel"
            });
        }

        await Reels.findByIdAndDelete(id);
        io.emit("reel:deleted", {
            reelId: id
        });
        return res.status(200).json({
            message: "Reel deleted successfully"
        });

    } catch (error) {
        console.error("DELETE REEL ERROR:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
});



// POST COMMENT ON REEL
// router.post("/reel/:reelId/comment", async (req, res) => {
//     try {
//         const { reelId } = req.params;
//         const { id, name, email, profile, text } = req.body;

//         if (!id || !name || !email || !profile || !text) {
//             return res.status(400).json({
//                 message: "All comment fields are required"
//             });
//         }

//         const reel = await Reels.findById(reelId);

//         if (!reel) {
//             return res.status(404).json({
//                 message: "Reel not found"
//             });
//         }

//         const newComment = {
//             id,
//             name,
//             email,
//             profile,
//             text,
//             likes: []
//         };

//         reel.comments.unshift(newComment); // newest first
//         await reel.save();
//         io.emit("reel:commentAdded", {
//             reelId,
//             comment: reel.comments[0]
//         });
//         return res.status(201).json({
//             message: "Comment added successfully",
//             comments: reel.comments
//         });

//     } catch (error) {
//         console.error("POST COMMENT ERROR:", error);
//         return res.status(500).json({
//             message: "Internal server error"
//         });
//     }
// });
// POST COMMENT ON REEL
router.post("/reel/:reelId/comment", async (req, res) => {
    try {
        const { reelId } = req.params;
        const { id, name, email, profile, text } = req.body;

        if (!id || !name || !email || !profile || !text) {
            return res.status(400).json({ message: "All comment fields are required" });
        }

        const reel = await Reels.findById(reelId);
        if (!reel) return res.status(404).json({ message: "Reel not found" });

        const newComment = { id, name, email, profile, text, likes: [] };
        reel.comments.unshift(newComment);
        await reel.save();

        // Emit to all clients – ensure correct event name
        io.emit("reel:commentAdded", {
            reelId: reel._id.toString(),  // make sure it's a string
            comment: newComment
        });

        return res.status(201).json({
            message: "Comment added successfully",
            comments: reel.comments
        });

    } catch (error) {
        console.error("POST COMMENT ERROR:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
});



// LIKE / UNLIKE A REEL
router.post("/reel/:reelId/like", async (req, res) => {
    try {
        const { reelId } = req.params;
        const { id, name, email, profile } = req.body;

        if (!id || !name || !email || !profile) {
            return res.status(400).json({
                message: "All like fields are required"
            });
        }

        const reel = await Reels.findById(reelId);

        if (!reel) {
            return res.status(404).json({
                message: "Reel not found"
            });
        }

        // Check if user already liked the reel
        const existingLikeIndex = reel.likes.findIndex(
            (like) => like.id.toString() === id
        );

        if (existingLikeIndex !== -1) {
            // User already liked → UNLIKE
            reel.likes.splice(existingLikeIndex, 1);
        } else {
            // NEW LIKE
            reel.likes.push({
                id,
                name,
                email,
                profile
            });
        }

        await reel.save();


        io.emit("reel:likeUpdated", {
            reelId,
            likes: reel.likes
        });

        return res.status(200).json({
            message: existingLikeIndex !== -1 ? "Like removed" : "Reel liked",
            likesCount: reel.likes.length,
            likes: reel.likes
        });

    } catch (error) {
        console.error("REEL LIKE ERROR:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
});





// GET SINGLE REEL BY ID
router.get("/reel/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const reel = await Reels.findById(id);

        if (!reel) {
            return res.status(404).json({
                message: "Reel not found"
            });
        }

        return res.status(200).json({
            reel
        });

    } catch (error) {
        console.error("GET REEL BY ID ERROR:", error);

        // Invalid MongoDB ObjectId
        if (error.name === "CastError") {
            return res.status(400).json({
                message: "Invalid reel ID"
            });
        }

        return res.status(500).json({
            message: "Internal server error"
        });
    }
});

router.delete("/", async (req, res) => {
    try {
        await Reels.deleteMany();
        res.status(200).json({ message: "deleted sucessfully" })

    } catch (error) {
        console.log('====================================');
        console.log(error);
        console.log('====================================');
    }
})
export default router;


















