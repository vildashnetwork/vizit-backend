// routes/liveRoutes.js
import express from "express";
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

// Send email notification
const sendLiveNotificationEmail = async (email, liveSession, owner, type = 'started') => {
    const apiKey = process.env.BREVO_API_KEY;
    const url = "https://api.brevo.com/v3/smtp/email";
    const roomUrl = `https://sfu.mirotalk.com/join/?room=${liveSession.streamKey}`;

    let subject = "";
    let content = "";

    if (type === 'scheduled') {
        subject = `📅 Live Session Scheduled: ${liveSession.title}`;
        content = `
            <h2>Live Session Scheduled</h2>
            <p><strong>${liveSession.title}</strong> has been scheduled for <strong>${new Date(liveSession.scheduledAt).toLocaleString()}</strong></p>
            <p>${liveSession.description || "Join this live session to see exclusive property tours!"}</p>
            <p>You'll receive a reminder 5 minutes before it starts.</p>
            <div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <p>Room link: <a href="${roomUrl}">${roomUrl}</a></p>
            </div>
        `;
    } else if (type === 'reminder') {
        subject = `🔔 Starting Soon: ${liveSession.title}`;
        content = `
            <h2>Live Session Starting Soon!</h2>
            <p><strong>${liveSession.title}</strong> starts in 5 minutes!</p>
            <p>${liveSession.description || "Don't miss out!"}</p>
            <div style="background: #ff4444; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                <a href="${roomUrl}" style="color: white; text-decoration: none; font-weight: bold;">
                    Join Now
                </a>
            </div>
        `;
    } else {
        subject = `🔴 LIVE NOW: ${liveSession.title}`;
        content = `
            <h2 style="color: #ef4444;">🔴 LIVE NOW</h2>
            <p><strong>${liveSession.title}</strong> is now live!</p>
            <p>${liveSession.description || "Join now to see exclusive property tours!"}</p>
            <div style="background: #ef4444; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                <a href="${roomUrl}" style="color: white; text-decoration: none; font-weight: bold;">
                    Join Live Session
                </a>
            </div>
        `;
    }

    const emailContent = {
        sender: { name: "Vizit Live", email: process.env.SUPPORT_EMAIL || "support@vizit.homes" },
        to: [{ email: email }],
        subject: subject,
        htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-top: 5px solid #10ca8c;">
                <div style="background-color: #f9f9f9; padding: 20px; text-align: center;">
                    <h1 style="color: #10ca8c; margin: 0;">Vizit Live</h1>
                </div>
                <div style="padding: 30px; color: #333;">
                    ${content}
                    <p style="margin-top: 20px; font-size: 12px; color: #999;">
                        You're receiving this because you're a Vizit user.
                    </p>
                </div>
                <div style="background: #244531; color: white; padding: 15px; text-align: center; font-size: 12px;">
                    © ${new Date().getFullYear()} Vizit Properties. All rights reserved.
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
        return users.map(user => user.email);
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

// Create a new live session (can be immediate or scheduled)
export const createLiveSession = async (req, res) => {
    try {
        const { createdbyId, title, description, scheduledAt } = req.body;

        if (!createdbyId) {
            return res.status(400).json({
                success: false,
                message: "Owner ID is required"
            });
        }

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

        const streamKey = generateStreamKey();
        const roomUrl = `https://sfu.mirotalk.com/join/?room=${streamKey}`;

        const isScheduled = !!scheduledAt;
        const sessionDate = isScheduled ? new Date(scheduledAt) : null;

        const liveSession = new LiveSession({
            createdbyId,
            title: title || "Live Session",
            description: description || "",
            streamKey,
            roomUrl,
            isLive: false,
            isScheduled,
            scheduledAt: sessionDate,
            reminderSent: false,
            scheduledNotificationSent: false
        });

        await liveSession.save();

        // Send notification emails for scheduled sessions
        if (isScheduled && sessionDate > new Date()) {
            const houseSeekers = await getAllHouseSeekersEmails();
            const owner = await getOwnerDetails(createdbyId);

            // Send to all house seekers
            const seekerPromises = houseSeekers.map(email =>
                sendLiveNotificationEmail(email, liveSession, owner, 'scheduled')
            );

            // Send to owner as well
            if (owner?.email) {
                seekerPromises.push(sendLiveNotificationEmail(owner.email, liveSession, owner, 'scheduled'));
            }

            Promise.all(seekerPromises).catch(err =>
                console.error("Error sending scheduled notifications:", err)
            );

            // Create notification record
            const notification = new LiveNotification({
                liveSessionId: liveSession._id,
                recipientIds: houseSeekers,
                type: 'scheduled'
            });
            await notification.save();
        }

        res.status(201).json({
            success: true,
            message: isScheduled ? "Live session scheduled successfully!" : "Live session created successfully!",
            liveSession: {
                _id: liveSession._id,
                title: liveSession.title,
                description: liveSession.description,
                streamKey: liveSession.streamKey,
                roomUrl: liveSession.roomUrl,
                isLive: liveSession.isLive,
                isScheduled: liveSession.isScheduled,
                scheduledAt: liveSession.scheduledAt
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

// Toggle live session (start/end)
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
            liveSession.isScheduled = false;
            liveSession.startedAt = new Date();
            liveSession.endedAt = null;
            await liveSession.save();

            // Get all house seekers
            const houseSeekers = await getAllHouseSeekersEmails();

            // Send notifications
            const notificationPromises = houseSeekers.map(email =>
                sendLiveNotificationEmail(email, liveSession, owner, 'started')
            );

            // Send to owner as well
            if (owner?.email) {
                notificationPromises.push(sendLiveNotificationEmail(owner.email, liveSession, owner, 'started'));
            }

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
                success: true,
                message: `Live session started! Notifications sent to ${houseSeekers.length} users.`,
                isLive: true,
                roomUrl: liveSession.roomUrl,
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

// Get all live sessions (active, scheduled, and past)
export const getAllLiveSessions = async (req, res) => {
    try {
        const liveSessions = await LiveSession.find({})
            .populate('createdbyId', 'name profile companyname')
            .sort({ scheduledAt: 1, createdAt: -1 });

        res.status(200).json({
            success: true,
            liveSessions
        });
    } catch (error) {
        console.error("Get all live sessions error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get active live sessions (for house seekers)
export const getActiveLiveSessions = async (req, res) => {
    try {
        const activeSessions = await LiveSession.find({ isLive: true })
            .populate('createdbyId', 'name profile companyname')
            .sort({ startedAt: -1 });

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

// Get scheduled live sessions
export const getScheduledLiveSessions = async (req, res) => {
    try {
        const scheduledSessions = await LiveSession.find({
            isScheduled: true,
            isLive: false,
            scheduledAt: { $gt: new Date() }
        })
            .populate('createdbyId', 'name profile companyname')
            .sort({ scheduledAt: 1 });

        res.status(200).json({
            success: true,
            scheduledSessions
        });
    } catch (error) {
        console.error("Get scheduled live sessions error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Join a live session
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

        if (!liveSession.isLive && !liveSession.isScheduled) {
            return res.status(400).json({
                success: false,
                message: "Live session is not active"
            });
        }

        if (!liveSession.viewers.includes(userId)) {
            liveSession.viewers.push(userId);
            await liveSession.save();
        }

        res.status(200).json({
            success: true,
            message: liveSession.isLive ? "Joined live session" : "Session scheduled",
            viewerCount: liveSession.viewers.length,
            roomUrl: liveSession.isLive ? `https://sfu.mirotalk.com/join/?room=${liveSession.streamKey}` : null,
            scheduledAt: liveSession.scheduledAt
        });
    } catch (error) {
        console.error("Join live session error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Reminder cron job function
export const startReminderCron = () => {
    setInterval(async () => {
        try {
            const now = new Date();
            const reminderThreshold = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now

            const upcomingSessions = await LiveSession.find({
                isScheduled: true,
                isLive: false,
                scheduledAt: { $lte: reminderThreshold, $gt: now },
                reminderSent: false
            }).populate('createdbyId');

            for (const session of upcomingSessions) {
                const houseSeekers = await getAllHouseSeekersEmails();
                const owner = session.createdbyId;

                const reminderPromises = houseSeekers.map(email =>
                    sendLiveNotificationEmail(email, session, owner, 'reminder')
                );

                if (owner?.email) {
                    reminderPromises.push(sendLiveNotificationEmail(owner.email, session, owner, 'reminder'));
                }

                await Promise.all(reminderPromises);

                session.reminderSent = true;
                await session.save();

                const notification = new LiveNotification({
                    liveSessionId: session._id,
                    recipientIds: houseSeekers,
                    type: 'reminder'
                });
                await notification.save();

                console.log(`✅ Reminders sent for session: ${session.title}`);
            }
        } catch (error) {
            console.error("Reminder cron error:", error);
        }
    }, 60000); // Check every minute
};

// Route definitions
router.post("/live/create", createLiveSession);
router.post("/live/toggle", toggleLiveSession);
router.delete("/live/delete", deleteLiveSession);
router.get("/live/owner/:ownerId", getOwnerLiveSessions);
router.get("/live/owner/:ownerId/active", getActiveLiveSession);
router.get("/live/active", getActiveLiveSessions);
router.get("/live/scheduled", getScheduledLiveSessions);
router.get("/live/all", getAllLiveSessions);
router.post("/live/join", joinLiveSession);

export default router;