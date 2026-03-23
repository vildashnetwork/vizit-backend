// routes/liveRoutes.js
import express from "express";
import mongoose from "mongoose";
import LiveSession from "../models/LiveSessions.js";
import LiveNotification from "../models/LiveNotification.js";
import UserModel from "../models/Users.js";
import HouseOwnerModel from "../models/HouseOwners.js";
import crypto from "crypto";
import axios from "axios";

const router = express.Router();

// Generate unique stream key
const generateStreamKey = () => {
    return crypto.randomBytes(16).toString('hex');
};

// Send email notification to all house seekers
const sendLiveNotificationEmail = async (email, liveSession, owner) => {
    const apiKey = process.env.BREVO_API_KEY;
    const url = "https://api.brevo.com/v3/smtp/email";

    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };

    const roomUrl = `https://sfu.mirotalk.com/join/?room=${liveSession.streamKey}`;
    const appUrl = process.env.APP_URL || "https://auth.vizit.homes";

    const emailContent = {
        sender: { name: "Vizit Live", email: process.env.SUPPORT_EMAIL || "support@vizit.homes" },
        to: [{ email: email }],
        subject: `🔴 LIVE NOW: ${liveSession.title}`,
        htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-top: 5px solid #ff4444;">
                <div style="background-color: #f9f9f9; padding: 20px; text-align: center;">
                    <h1 style="color: #ff4444; margin: 0;">🔴 LIVE NOW</h1>
                </div>
                <div style="padding: 30px; color: #333;">
                    <h2>${liveSession.title}</h2>
                    <p><strong>Host:</strong> ${owner?.name || "Property Owner"}</p>
                    <p>${liveSession.description || "A new live session has started! Join now to see exclusive property tours and Q&A sessions."}</p>
                    <div style="background: #ff4444; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                        <a href="${roomUrl}" 
                           style="color: white; text-decoration: none; font-weight: bold; font-size: 16px;">
                           Click here to join the live stream
                        </a>
                    </div>
                    <div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 15px 0;">
                        <p style="margin: 0; font-size: 12px; color: #666;">💡 Tip: You can also copy this link to share with friends:</p>
                        <p style="margin: 5px 0 0 0; font-size: 11px; color: #999; word-break: break-all;">${roomUrl}</p>
                    </div>
                    <p style="margin-top: 20px;">Don't miss out on this exciting live session!</p>
                </div>
                <div style="background: #244531; color: white; padding: 15px; text-align: center; font-size: 12px;">
                    © ${new Date().toLocaleString('en-US', options)} Vizit Properties. All rights reserved.
                </div>
            </div>
        `
    };

    try {
        await axios.post(url, emailContent, {
            headers: { "api-key": apiKey, "Content-Type": "application/json" }
        });
        return true;
    } catch (error) {
        console.error(`Failed to send email to ${email}:`, error.message);
        return false;
    }
};

// Get all house seekers emails
const getAllHouseSeekersEmails = async () => {
    try {
        const users = await UserModel.find({}, { email: 1, name: 1 });
        return users.map(user => ({
            email: user.email,
            name: user.name
        }));
    } catch (error) {
        console.error("Error fetching house seekers:", error);
        return [];
    }
};

// Get owner details
const getOwnerDetails = async (ownerId) => {
    try {
        const owner = await HouseOwnerModel.findById(ownerId);
        return owner;
    } catch (error) {
        console.error("Error fetching owner:", error);
        return null;
    }
};

// Create a new live session
export const createLiveSession = async (req, res) => {
    try {
        const { createdbyId, title, description } = req.body;

        if (!createdbyId) {
            return res.status(400).json({
                success: false,
                message: "Owner ID is required"
            });
        }

        // Check if owner already has an active live session
        const existingLive = await LiveSession.findOne({
            createdbyId,
            isLive: true
        });

        if (existingLive) {
            return res.status(400).json({
                success: false,
                message: "You already have an active live session. End it before creating a new one."
            });
        }

        // Generate stream key and room URL
        const streamKey = generateStreamKey();
        const roomUrl = `https://sfu.mirotalk.com/join/?room=${streamKey}`;

        const liveSession = new LiveSession({
            createdbyId,
            title: title || "Live Session",
            description: description || "",
            streamKey,
            roomUrl,
            isLive: false
        });

        await liveSession.save();

        res.status(201).json({
            success: true,
            message: "Live session created successfully",
            liveSession: {
                _id: liveSession._id,
                title: liveSession.title,
                description: liveSession.description,
                streamKey: liveSession.streamKey,
                roomUrl: liveSession.roomUrl,
                isLive: liveSession.isLive
            }
        });
    } catch (error) {
        console.error("Create live session error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Start a live session (toggle isLive to true)
export const startLiveSession = async (req, res) => {
    try {
        const { sessionId, streamKey } = req.body;

        if (!sessionId || !streamKey) {
            return res.status(400).json({
                success: false,
                message: "Session ID and stream key are required"
            });
        }

        const liveSession = await LiveSession.findOne({ _id: sessionId, streamKey });

        if (!liveSession) {
            return res.status(404).json({
                success: false,
                message: "Live session not found or invalid stream key"
            });
        }

        if (liveSession.isLive) {
            return res.status(400).json({
                success: false,
                message: "Live session is already active"
            });
        }

        // Get owner details for email
        const owner = await getOwnerDetails(liveSession.createdbyId);

        // Update to live
        liveSession.isLive = true;
        liveSession.startedAt = new Date();
        liveSession.endedAt = null;
        await liveSession.save();

        // Get all house seekers emails
        const houseSeekers = await getAllHouseSeekersEmails();

        // Send email notifications to all house seekers
        const notificationPromises = houseSeekers.map(seeker =>
            sendLiveNotificationEmail(seeker.email, liveSession, owner)
        );

        // Create notification record
        const notification = new LiveNotification({
            liveSessionId: liveSession._id,
            recipientIds: houseSeekers.map(s => s.email),
            type: 'started'
        });
        await notification.save();

        // Send notifications in background (don't wait for all to complete)
        Promise.all(notificationPromises).then(results => {
            const successCount = results.filter(r => r === true).length;
            console.log(`✅ Sent ${successCount} notifications out of ${houseSeekers.length}`);
        }).catch(err =>
            console.error("Error sending notifications:", err)
        );

        res.status(200).json({
            success: true,
            message: `Live session started. Notifications sent to ${houseSeekers.length} house seekers.`,
            liveSession: {
                _id: liveSession._id,
                title: liveSession.title,
                roomUrl: liveSession.roomUrl,
                streamKey: liveSession.streamKey,
                isLive: liveSession.isLive,
                startedAt: liveSession.startedAt
            }
        });
    } catch (error) {
        console.error("Start live session error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// End a live session (toggle isLive to false)
export const endLiveSession = async (req, res) => {
    try {
        const { sessionId, streamKey } = req.body;

        const liveSession = await LiveSession.findOne({ _id: sessionId, streamKey });

        if (!liveSession) {
            return res.status(404).json({
                success: false,
                message: "Live session not found or invalid stream key"
            });
        }

        if (!liveSession.isLive) {
            return res.status(400).json({
                success: false,
                message: "Live session is not active"
            });
        }

        liveSession.isLive = false;
        liveSession.endedAt = new Date();
        await liveSession.save();

        // Create notification record
        const notification = new LiveNotification({
            liveSessionId: liveSession._id,
            type: 'ended'
        });
        await notification.save();

        res.status(200).json({
            success: true,
            message: "Live session ended",
            liveSession
        });
    } catch (error) {
        console.error("End live session error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete a live session
export const deleteLiveSession = async (req, res) => {
    try {
        const { sessionId, streamKey } = req.body;

        const liveSession = await LiveSession.findOne({ _id: sessionId, streamKey });

        if (!liveSession) {
            return res.status(404).json({
                success: false,
                message: "Live session not found or invalid stream key"
            });
        }

        await LiveSession.findByIdAndDelete(sessionId);

        // Also delete associated notifications
        await LiveNotification.deleteMany({ liveSessionId: sessionId });

        res.status(200).json({
            success: true,
            message: "Live session deleted successfully"
        });
    } catch (error) {
        console.error("Delete live session error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all live sessions for an owner
export const getOwnerLiveSessions = async (req, res) => {
    try {
        const { ownerId } = req.params;

        const liveSessions = await LiveSession.find({ createdbyId: ownerId })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            liveSessions
        });
    } catch (error) {
        console.error("Get owner live sessions error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get active live session for an owner
export const getActiveLiveSession = async (req, res) => {
    try {
        const { ownerId } = req.params;

        const activeSession = await LiveSession.findOne({
            createdbyId: ownerId,
            isLive: true
        });

        res.status(200).json({
            success: true,
            activeSession: activeSession || null
        });
    } catch (error) {
        console.error("Get active live session error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get all active live sessions (for house seekers)
export const getActiveLiveSessions = async (req, res) => {
    try {
        const activeSessions = await LiveSession.find({ isLive: true })
            .populate('createdbyId', 'name profile companyname')
            .sort({ startedAt: -1 });

        // Add room URL to each session
        const sessionsWithUrl = activeSessions.map(session => ({
            ...session.toObject(),
            roomUrl: `https://sfu.mirotalk.com/join/?room=${session.streamKey}`
        }));

        res.status(200).json({
            success: true,
            activeSessions: sessionsWithUrl
        });
    } catch (error) {
        console.error("Get active live sessions error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get a single live session
export const getLiveSession = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const liveSession = await LiveSession.findById(sessionId)
            .populate('createdbyId', 'name email profile companyname');

        if (!liveSession) {
            return res.status(404).json({
                success: false,
                message: "Live session not found"
            });
        }

        // Add room URL
        const sessionData = {
            ...liveSession.toObject(),
            roomUrl: `https://sfu.mirotalk.com/join/?room=${liveSession.streamKey}`
        };

        res.status(200).json({
            success: true,
            liveSession: sessionData
        });
    } catch (error) {
        console.error("Get live session error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Join a live session (add user to viewers)
export const joinLiveSession = async (req, res) => {
    try {
        const { sessionId, userId } = req.body;

        const liveSession = await LiveSession.findById(sessionId);

        if (!liveSession) {
            return res.status(404).json({
                success: false,
                message: "Live session not found"
            });
        }

        if (!liveSession.isLive) {
            return res.status(400).json({
                success: false,
                message: "Live session is not active"
            });
        }

        // Add user to viewers if not already present
        if (!liveSession.viewers.includes(userId)) {
            liveSession.viewers.push(userId);
            await liveSession.save();
        }

        res.status(200).json({
            success: true,
            message: "Joined live session",
            viewerCount: liveSession.viewers.length,
            roomUrl: `https://sfu.mirotalk.com/join/?room=${liveSession.streamKey}`
        });
    } catch (error) {
        console.error("Join live session error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Leave a live session (remove user from viewers)
export const leaveLiveSession = async (req, res) => {
    try {
        const { sessionId, userId } = req.body;

        const liveSession = await LiveSession.findById(sessionId);

        if (!liveSession) {
            return res.status(404).json({
                success: false,
                message: "Live session not found"
            });
        }

        liveSession.viewers = liveSession.viewers.filter(id => id.toString() !== userId);
        await liveSession.save();

        res.status(200).json({
            success: true,
            message: "Left live session",
            viewerCount: liveSession.viewers.length
        });
    } catch (error) {
        console.error("Leave live session error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get viewer count for a live session
export const getViewerCount = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const liveSession = await LiveSession.findById(sessionId);

        if (!liveSession) {
            return res.status(404).json({
                success: false,
                message: "Live session not found"
            });
        }

        res.status(200).json({
            success: true,
            viewerCount: liveSession.viewers.length,
            isLive: liveSession.isLive
        });
    } catch (error) {
        console.error("Get viewer count error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Toggle live session status (start/end) - Single endpoint for both
export const toggleLiveSession = async (req, res) => {
    try {
        const { sessionId, streamKey } = req.body;

        const liveSession = await LiveSession.findOne({ _id: sessionId, streamKey });

        if (!liveSession) {
            return res.status(404).json({
                success: false,
                message: "Live session not found or invalid stream key"
            });
        }

        if (liveSession.isLive) {
            // End the session
            liveSession.isLive = false;
            liveSession.endedAt = new Date();
            await liveSession.save();

            // Create notification record
            const notification = new LiveNotification({
                liveSessionId: liveSession._id,
                type: 'ended'
            });
            await notification.save();

            res.status(200).json({
                success: true,
                message: "Live session ended",
                isLive: false,
                liveSession
            });
        } else {
            // Start the session
            const owner = await getOwnerDetails(liveSession.createdbyId);

            liveSession.isLive = true;
            liveSession.startedAt = new Date();
            liveSession.endedAt = null;
            await liveSession.save();

            // Get all house seekers
            const houseSeekers = await getAllHouseSeekersEmails();

            // Send notifications
            const notificationPromises = houseSeekers.map(seeker =>
                sendLiveNotificationEmail(seeker.email, liveSession, owner)
            );

            const notification = new LiveNotification({
                liveSessionId: liveSession._id,
                recipientIds: houseSeekers.map(s => s.email),
                type: 'started'
            });
            await notification.save();

            // Send in background
            Promise.all(notificationPromises).catch(err =>
                console.error("Error sending notifications:", err)
            );

            res.status(200).json({
                success: true,
                message: `Live session started. Notifications sent to ${houseSeekers.length} users.`,
                isLive: true,
                roomUrl: `https://sfu.mirotalk.com/join/?room=${liveSession.streamKey}`,
                liveSession
            });
        }
    } catch (error) {
        console.error("Toggle live session error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Route definitions
router.post("/live/create", createLiveSession);
router.post("/live/start", startLiveSession);
router.post("/live/end", endLiveSession);
router.delete("/live/delete", deleteLiveSession);
router.get("/live/owner/:ownerId", getOwnerLiveSessions);
router.get("/live/owner/:ownerId/active", getActiveLiveSession);
router.get("/live/active", getActiveLiveSessions);
router.get("/live/:sessionId", getLiveSession);
router.post("/live/join", joinLiveSession);
router.post("/live/leave", leaveLiveSession);
router.get("/live/viewers/:sessionId", getViewerCount);
router.post("/live/toggle", toggleLiveSession);

export default router;