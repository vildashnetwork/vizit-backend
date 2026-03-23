// models/LiveNotification.js
import mongoose from "mongoose";

const liveNotificationSchema = new mongoose.Schema({
    liveSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LiveSession",
        required: true
    },
    recipientIds: {
        type: [mongoose.Schema.Types.ObjectId],
        default: []
    },
    sentAt: {
        type: Date,
        default: Date.now
    },
    type: {
        type: String,
        enum: ['started', 'ended', 'scheduled'],
        default: 'started'
    }
}, { timestamps: true });

const LiveNotification = mongoose.model("LiveNotification", liveNotificationSchema);
export default LiveNotification;