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
    return crypto.randomBytes(32).toString('hex');
};

// Send email notification to all house seekers
const sendLiveNotificationEmail = async (email, liveSession) => {
    const apiKey = process.env.BREVO_API_KEY;
    const url = "https://api.brevo.com/v3/smtp/email";

    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };

    const emailContent = {
        sender: { name: "Vizit Live", email: process.env.SUPPORT_EMAIL },
        to: [{ email: email }],
        subject: `🔴 LIVE NOW: ${liveSession.title}`,
        htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-top: 5px solid #ff4444;">
        <div style="background-color: #f9f9f9; padding: 20px; text-align: center;">
          <h1 style="color: #ff4444; margin: 0;">🔴 LIVE NOW</h1>
        </div>
        <div style="padding: 30px; color: #333;">
          <h2>${liveSession.title}</h2>
          <p>${liveSession.description || "A new live session has started!"}</p>
          <div style="background: #ff4444; padding: 15px; text-align: center; border-radius: 8px;">
            <a href="${process.env.APP_URL}/live/${liveSession._id}" 
               style="color: white; text-decoration: none; font-weight: bold;">
              Click here to join the live stream
            </a>
          </div>
          <p style="margin-top: 20px;">Don't miss out on this exciting live session!</p>
        </div>
        <div style="background: #244531; color: white; padding: 15px; text-align: center; font-size: 12px;">
          © ${new Date().toLocaleString('en-US', options)} Vizit Properties. All rights reserved.
        </div>
      </div>
    `
    };

    await axios.post(url, emailContent, {
        headers: { "api-key": apiKey, "Content-Type": "application/json" }
    });
};

// Get all house seekers emails
const getAllHouseSeekersEmails = async () => {
    try {
        const users = await UserModel.find({}, { email: 1 });
        return users.map(user => user.email);
    } catch (error) {
        console.error("Error fetching house seekers:", error);
        return [];
    }
};

// Create a new live session
export const createLiveSession = async (req, res) => {
    try {
        const { createdbyId, title, description, scheduledStartTime } = req.body;

        if (!createdbyId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        // Check if user already has an active live session
        const existingLive = await LiveSession.findOne({
            createdbyId,
            isLive: true
        });

        if (existingLive) {
            return res.status(400).json({
                message: "You already have an active live session. End it before creating a new one."
            });
        }

        const streamKey = generateStreamKey();

        const liveSession = new LiveSession({
            createdbyId,
            title: title || "Live Session",
            description: description || "",
            streamKey,
            isLive: false,
            scheduledStartTime: scheduledStartTime ? new Date(scheduledStartTime) : null
        });

        await liveSession.save();

        res.status(201).json({
            message: "Live session created successfully",
            liveSession: {
                _id: liveSession._id,
                title: liveSession.title,
                description: liveSession.description,
                streamKey: liveSession.streamKey,
                isLive: liveSession.isLive,
                scheduledStartTime: liveSession.scheduledStartTime
            }
        });
    } catch (error) {
        console.error("Create live session error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Start a live session (toggle isLive to true)
export const startLiveSession = async (req, res) => {
    try {
        const { sessionId, streamKey } = req.body;

        const liveSession = await LiveSession.findOne({ _id: sessionId, streamKey });

        if (!liveSession) {
            return res.status(404).json({ message: "Live session not found or invalid stream key" });
        }

        if (liveSession.isLive) {
            return res.status(400).json({ message: "Live session is already active" });
        }

        // Update to live
        liveSession.isLive = true;
        liveSession.endedAt = null;
        await liveSession.save();

        // Get all house seekers emails
        const houseSeekers = await getAllHouseSeekersEmails();

        // Send email notifications to all house seekers
        const notificationPromises = houseSeekers.map(email =>
            sendLiveNotificationEmail(email, liveSession)
        );

        // Create notification record
        const notification = new LiveNotification({
            liveSessionId: liveSession._id,
            recipientIds: houseSeekers,
            type: 'started'
        });
        await notification.save();

        // Send notifications in background (don't wait for all to complete)
        Promise.all(notificationPromises).catch(err =>
            console.error("Error sending notifications:", err)
        );

        res.status(200).json({
            message: "Live session started. Notifications sent to all house seekers.",
            liveSession
        });
    } catch (error) {
        console.error("Start live session error:", error);
        res.status(500).json({ message: error.message });
    }
};

// End a live session (toggle isLive to false)
export const endLiveSession = async (req, res) => {
    try {
        const { sessionId, streamKey } = req.body;

        const liveSession = await LiveSession.findOne({ _id: sessionId, streamKey });

        if (!liveSession) {
            return res.status(404).json({ message: "Live session not found or invalid stream key" });
        }

        if (!liveSession.isLive) {
            return res.status(400).json({ message: "Live session is not active" });
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
            message: "Live session ended",
            liveSession
        });
    } catch (error) {
        console.error("End live session error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Delete a live session
export const deleteLiveSession = async (req, res) => {
    try {
        const { sessionId, streamKey } = req.body;

        const liveSession = await LiveSession.findOne({ _id: sessionId, streamKey });

        if (!liveSession) {
            return res.status(404).json({ message: "Live session not found or invalid stream key" });
        }

        await LiveSession.findByIdAndDelete(sessionId);

        // Also delete associated notifications
        await LiveNotification.deleteMany({ liveSessionId: sessionId });

        res.status(200).json({ message: "Live session deleted successfully" });
    } catch (error) {
        console.error("Delete live session error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Get all live sessions (active and past)
export const getAllLiveSessions = async (req, res) => {
    try {
        const { createdbyId } = req.query;
        const query = createdbyId ? { createdbyId } : {};

        const liveSessions = await LiveSession.find(query)
            .sort({ createdAt: -1 })
            .populate('createdbyId', 'name email profile');

        res.status(200).json({ liveSessions });
    } catch (error) {
        console.error("Get live sessions error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Get active live sessions
export const getActiveLiveSessions = async (req, res) => {
    try {
        const activeSessions = await LiveSession.find({ isLive: true })
            .sort({ createdAt: -1 })
            .populate('createdbyId', 'name email profile');

        res.status(200).json({ activeSessions });
    } catch (error) {
        console.error("Get active live sessions error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Get a single live session
export const getLiveSession = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const liveSession = await LiveSession.findById(sessionId)
            .populate('createdbyId', 'name email profile');

        if (!liveSession) {
            return res.status(404).json({ message: "Live session not found" });
        }

        res.status(200).json({ liveSession });
    } catch (error) {
        console.error("Get live session error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Join a live session (add user to viewers)
export const joinLiveSession = async (req, res) => {
    try {
        const { sessionId, userId } = req.body;

        const liveSession = await LiveSession.findById(sessionId);

        if (!liveSession) {
            return res.status(404).json({ message: "Live session not found" });
        }

        if (!liveSession.isLive) {
            return res.status(400).json({ message: "Live session is not active" });
        }

        // Add user to viewers if not already present
        if (!liveSession.viewers.includes(userId)) {
            liveSession.viewers.push(userId);
            await liveSession.save();
        }

        res.status(200).json({
            message: "Joined live session",
            viewers: liveSession.viewers.length
        });
    } catch (error) {
        console.error("Join live session error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Leave a live session (remove user from viewers)
export const leaveLiveSession = async (req, res) => {
    try {
        const { sessionId, userId } = req.body;

        const liveSession = await LiveSession.findById(sessionId);

        if (!liveSession) {
            return res.status(404).json({ message: "Live session not found" });
        }

        liveSession.viewers = liveSession.viewers.filter(id => id.toString() !== userId);
        await liveSession.save();

        res.status(200).json({
            message: "Left live session",
            viewers: liveSession.viewers.length
        });
    } catch (error) {
        console.error("Leave live session error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Get viewer count for a live session
export const getViewerCount = async (req, res) => {
    try {
        const { sessionId } = req.params;

        const liveSession = await LiveSession.findById(sessionId);

        if (!liveSession) {
            return res.status(404).json({ message: "Live session not found" });
        }

        res.status(200).json({
            viewerCount: liveSession.viewers.length,
            isLive: liveSession.isLive
        });
    } catch (error) {
        console.error("Get viewer count error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Schedule a live session (notify users at scheduled time)
export const scheduleLiveSession = async (req, res) => {
    try {
        const { createdbyId, title, description, scheduledStartTime } = req.body;

        const streamKey = generateStreamKey();

        const liveSession = new LiveSession({
            createdbyId,
            title,
            description,
            streamKey,
            isLive: false,
            scheduledStartTime: new Date(scheduledStartTime)
        });

        await liveSession.save();

        // Create scheduled notification record
        const notification = new LiveNotification({
            liveSessionId: liveSession._id,
            type: 'scheduled'
        });
        await notification.save();

        // Optionally send scheduled notifications (you might want to use a cron job for this)
        // This is just creating the record; actual email sending at scheduled time would need a scheduler

        res.status(201).json({
            message: "Live session scheduled successfully",
            liveSession
        });
    } catch (error) {
        console.error("Schedule live session error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Toggle live session status (start/end)
export const toggleLiveSession = async (req, res) => {
    try {
        const { sessionId, streamKey } = req.body;

        const liveSession = await LiveSession.findOne({ _id: sessionId, streamKey });

        if (!liveSession) {
            return res.status(404).json({ message: "Live session not found or invalid stream key" });
        }

        if (liveSession.isLive) {
            // End the session
            liveSession.isLive = false;
            liveSession.endedAt = new Date();
            await liveSession.save();

            res.status(200).json({
                message: "Live session ended",
                liveSession
            });
        } else {
            // Start the session
            liveSession.isLive = true;
            liveSession.endedAt = null;
            await liveSession.save();

            // Send notifications
            const houseSeekers = await getAllHouseSeekersEmails();
            const notificationPromises = houseSeekers.map(email =>
                sendLiveNotificationEmail(email, liveSession)
            );

            const notification = new LiveNotification({
                liveSessionId: liveSession._id,
                recipientIds: houseSeekers,
                type: 'started'
            });
            await notification.save();

            Promise.all(notificationPromises).catch(err =>
                console.error("Error sending notifications:", err)
            );

            res.status(200).json({
                message: "Live session started. Notifications sent.",
                liveSession
            });
        }
    } catch (error) {
        console.error("Toggle live session error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Route definitions
router.post("/create", createLiveSession);
router.post("/start", startLiveSession);
router.post("/end", endLiveSession);
router.delete("/delete", deleteLiveSession);
router.get("/all", getAllLiveSessions);
router.get("/active", getActiveLiveSessions);
router.get("/:sessionId", getLiveSession);
router.post("/join", joinLiveSession);
router.post("/leave", leaveLiveSession);
router.get("/viewers/:sessionId", getViewerCount);
router.post("/schedule", scheduleLiveSession);
router.post("/toggle", toggleLiveSession);

export default router;