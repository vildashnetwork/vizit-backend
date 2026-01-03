
import express from "express";
import Reels from "../models/Reels.js";
import { io } from "../socket.js";
const router = express.Router();





// LIKE / UNLIKE A COMMENT ON REEL
router.put("/reel/:reelId/comment/:commentId/like", async (req, res) => {
    console.log("🎯 COMMENT LIKE ROUTE HIT!");
    console.log("Params:", req.params);
    console.log("Body:", req.body);

    try {
        const { reelId, commentId } = req.params;
        const { id: userId } = req.body; // Changed to userId for clarity

        console.log(`🔍 Searching for reel: ${reelId}`);
        console.log(`🔍 Searching for comment: ${commentId}`);
        console.log(`👤 User ID: ${userId}`);

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required"
            });
        }

        const reel = await Reels.findById(reelId);
        if (!reel) {
            console.log(`❌ Reel not found: ${reelId}`);
            return res.status(404).json({
                success: false,
                message: "Reel not found"
            });
        }

        console.log(`✅ Found reel. Total comments: ${reel.comments.length}`);

        // Debug: Log all comments
        console.log("\n📋 ALL COMMENTS:");
        reel.comments.forEach((comment, index) => {
            console.log(`[${index}] _id: ${comment._id}, id(userId): ${comment.id}`);
        });

        // FIX: Search by comment._id instead of comment.id
        const comment = reel.comments.find(comment =>
            comment._id.toString() === commentId
        );

        if (!comment) {
            console.log(`❌ Comment not found! Looking for: ${commentId}`);
            console.log(`Available comment _ids:`, reel.comments.map(c => c._id.toString()));
            return res.status(404).json({
                success: false,
                message: "Comment not found",
                debug: {
                    searchedCommentId: commentId,
                    availableCommentIds: reel.comments.map(c => c._id.toString()),
                    note: "Use comment._id not comment.id"
                }
            });
        }

        console.log(`✅ Found comment: "${comment.text.substring(0, 50)}..."`);

        // Check if user already liked the comment
        const existingLikeIndex = comment.likes.findIndex(
            (like) => like.id && like.id.toString() === userId.toString()
        );

        console.log(`🔍 Like check: ${existingLikeIndex !== -1 ? 'Already liked' : 'Not liked yet'}`);

        if (existingLikeIndex !== -1) {
            // User already liked → UNLIKE
            comment.likes.splice(existingLikeIndex, 1);
            console.log(`👎 Removed like from user ${userId}`);
        } else {
            // NEW LIKE
            comment.likes.push({
                id: userId,
                time: new Date()
            });
            console.log(`👍 Added like from user ${userId}`);
        }

        await reel.save();


        io.emit("commentLikeUpdated", {
            reelId,
            commentId: comment._id,
            likesCount: comment.likes.length,
            likes: comment.likes,
            userId
        });


        console.log(` Saved. New likes count: ${comment.likes.length}`);

        return res.status(200).json({
            success: true,
            message: existingLikeIndex !== -1 ? "Like removed" : "Comment liked",
            likesCount: comment.likes.length,
            likes: comment.likes,
            commentId: comment._id
        });

    } catch (error) {
        console.error("❌ COMMENT LIKE ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
});



















router.post("/reel/:reelId/share", async (req, res) => {
    console.log("🎯 SHARE ROUTE HIT!");
    console.log("Params:", req.params);
    console.log("Body:", req.body);

    try {
        const { reelId } = req.params;
        const { id: userId, name } = req.body;

        console.log(`🔍 Searching for reel: ${reelId}`);
        console.log(`👤 User sharing: ${name} (${userId})`);

        // Validate input
        if (!userId || !name) {
            return res.status(400).json({
                success: false,
                message: "User ID and name are required"
            });
        }

        // Find the reel
        const reel = await Reels.findById(reelId);
        if (!reel) {
            console.log(`❌ Reel not found: ${reelId}`);
            return res.status(404).json({
                success: false,
                message: "Reel not found"
            });
        }

        console.log(`✅ Found reel: "${reel.caption.substring(0, 50)}..."`);
        console.log(`📊 Current shares: ${reel.shares.length}`);

        // Check if user already shared the reel
        const existingShareIndex = reel.shares.findIndex(
            (share) => share.id.toString() === userId.toString()
        );

        console.log(`🔍 Share check: ${existingShareIndex !== -1 ? 'Already shared' : 'Not shared yet'}`);

        let message = "";

        if (existingShareIndex !== -1) {
            // User already shared → UNSHARE
            reel.shares.splice(existingShareIndex, 1);
            message = "Share removed";
            console.log(`👎 Removed share from user ${name}`);
        } else {
            // NEW SHARE
            reel.shares.push({
                id: userId,
                name: name
            });
            message = "Reel shared";
            console.log(`👍 Added share from user ${name}`);
        }

        await reel.save();


        io.emit("reelShareUpdated", {
            reelId: reel._id,
            sharesCount: reel.shares.length,
            shares: reel.shares,
            userId,
            name
        });

        console.log(` Saved. New shares count: ${reel.shares.length}`);

        return res.status(200).json({
            success: true,
            message: message,
            sharesCount: reel.shares.length,
            shares: reel.shares,
            reelId: reel._id
        });

    } catch (error) {
        console.error("❌ SHARE REEL ERROR:", error);

        // Handle specific errors
        if (error.name === "CastError") {
            return res.status(400).json({
                success: false,
                message: "Invalid reel ID format"
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
});


export default router