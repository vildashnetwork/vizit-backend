// models/LiveSession.js
import mongoose from "mongoose";

const liveSessionSchema = new mongoose.Schema({
  createdbyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "HouseOwner",
    required: true
  },
  title: {
    type: String,
    required: true,
    default: "Live Session"
  },
  description: {
    type: String,
    default: ""
  },
  streamKey: {
    type: String,
    required: true,
    unique: true
  },
  roomUrl: {
    type: String,
    default: ""
  },
  viewers: {
    type: [String],
    default: []
  },
  isLive: {
    type: Boolean,
    default: false
  },
  startedAt: {
    type: Date,
    default: null
  },
  endedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Generate unique stream key
liveSessionSchema.statics.generateStreamKey = function() {
  return require('crypto').randomBytes(16).toString('hex');
};

// Generate room URL
liveSessionSchema.methods.generateRoomUrl = function() {
  return `https://sfu.mirotalk.com/join/?room=${this.streamKey}`;
};

const LiveSession = mongoose.model("LiveSession", liveSessionSchema);
export default LiveSession;