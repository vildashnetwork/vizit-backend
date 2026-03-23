// models/LiveSession.js
import mongoose from "mongoose";

const liveSessionSchema = new mongoose.Schema({
    createdbyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    title: {
        type: String,
        default: ""
    },
    description: {
        type: String,
        default: ""
    },
    streamKey: {
        type: String,
        default: ""
    },
    viewers: {
        type: [String], // Array of user IDs who are watching
        default: []
    },
    isLive: {
        type: Boolean,
        default: false
    },
    scheduledStartTime: {
        type: Date,
        default: null
    },
    endedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

const LiveSession = mongoose.model("LiveSession", liveSessionSchema);
export default LiveSession;