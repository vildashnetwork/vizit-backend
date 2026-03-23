// models/LiveSession.js
import mongoose from "mongoose";
import crypto from "crypto";

const liveSessionSchema = new mongoose.Schema({
  createdbyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "houseowner",  // Make sure this matches your HouseOwner model name exactly
    required: [true, "Owner ID is required"]
  },
  title: {
    type: String,
    required: [true, "Session title is required"],
    trim: true,
    maxlength: [200, "Title cannot exceed 200 characters"],
    default: "Live Session"
  },
  description: {
    type: String,
    default: "",
    maxlength: [1000, "Description cannot exceed 1000 characters"]
  },
  streamKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  roomUrl: {
    type: String,
    default: ""
  },
  viewers: {
    type: [String],
    default: [],
    index: true
  },
  viewerCount: {
    type: Number,
    default: 0
  },
  isLive: {
    type: Boolean,
    default: false,
    index: true
  },
  isScheduled: {
    type: Boolean,
    default: false,
    index: true
  },
  scheduledAt: {
    type: Date,
    default: null,
    index: true
  },
  reminderSent: {
    type: Boolean,
    default: false
  },
  scheduledNotificationSent: {
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
  },
  duration: {
    type: Number,  // Duration in minutes
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for formatted duration
liveSessionSchema.virtual('formattedDuration').get(function () {
  if (!this.duration) return '0 min';
  if (this.duration < 60) return `${this.duration} min`;
  const hours = Math.floor(this.duration / 60);
  const mins = this.duration % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
});

// Virtual for session status
liveSessionSchema.virtual('status').get(function () {
  const now = new Date();
  if (this.isLive) return 'live';
  if (this.isScheduled && this.scheduledAt && this.scheduledAt > now) return 'scheduled';
  return 'ended';
});

// Static method to generate unique stream key
liveSessionSchema.statics.generateStreamKey = function () {
  return crypto.randomBytes(16).toString('hex');
};

// Instance method to generate room URL
liveSessionSchema.methods.generateRoomUrl = function () {
  return `https://sfu.mirotalk.com/join/?room=${this.streamKey}`;
};

// Instance method to start session
liveSessionSchema.methods.startSession = async function () {
  this.isLive = true;
  this.isScheduled = false;
  this.startedAt = new Date();
  this.endedAt = null;
  if (!this.roomUrl) {
    this.roomUrl = this.generateRoomUrl();
  }
  return await this.save();
};

// Instance method to end session
liveSessionSchema.methods.endSession = async function () {
  this.isLive = false;
  this.endedAt = new Date();
  if (this.startedAt) {
    this.duration = Math.floor((this.endedAt - this.startedAt) / 60000);
  }
  return await this.save();
};

// Instance method to add viewer
liveSessionSchema.methods.addViewer = async function (userId) {
  if (!this.viewers.includes(userId)) {
    this.viewers.push(userId);
    this.viewerCount = this.viewers.length;
    await this.save();
  }
  return this.viewerCount;
};

// Instance method to remove viewer
liveSessionSchema.methods.removeViewer = async function (userId) {
  this.viewers = this.viewers.filter(id => id !== userId);
  this.viewerCount = this.viewers.length;
  await this.save();
  return this.viewerCount;
};

// Static method to find active sessions
liveSessionSchema.statics.findActive = function () {
  return this.find({ isLive: true }).sort({ startedAt: -1 });
};

// Static method to find upcoming scheduled sessions
liveSessionSchema.statics.findUpcomingScheduled = function () {
  return this.find({
    isScheduled: true,
    isLive: false,
    scheduledAt: { $gt: new Date() }
  }).sort({ scheduledAt: 1 });
};

// Static method to find sessions for an owner
liveSessionSchema.statics.findByOwner = function (ownerId) {
  return this.find({ createdbyId: ownerId }).sort({ createdAt: -1 });
};

// Pre-save middleware to generate stream key if not provided
liveSessionSchema.pre('save', async function (next) {
  if (!this.streamKey) {
    this.streamKey = this.constructor.generateStreamKey();
  }
  if (!this.roomUrl) {
    this.roomUrl = this.generateRoomUrl();
  }
  if (this.viewers) {
    this.viewerCount = this.viewers.length;
  }
  next();
});

// Pre-update middleware to update viewer count
liveSessionSchema.pre('findOneAndUpdate', async function (next) {
  const update = this.getUpdate();
  if (update.$push && update.$push.viewers) {
    const doc = await this.model.findOne(this.getQuery());
    if (doc) {
      update.viewerCount = (doc.viewerCount || 0) + 1;
    }
  }
  if (update.$pull && update.$pull.viewers) {
    const doc = await this.model.findOne(this.getQuery());
    if (doc && doc.viewerCount > 0) {
      update.viewerCount = (doc.viewerCount || 0) - 1;
    }
  }
  next();
});

// Indexes for better query performance
liveSessionSchema.index({ createdbyId: 1, isLive: 1 });
liveSessionSchema.index({ isLive: 1, startedAt: -1 });
liveSessionSchema.index({ isScheduled: 1, scheduledAt: 1 });
liveSessionSchema.index({ streamKey: 1 }, { unique: true });

const LiveSession = mongoose.model("LiveSession", liveSessionSchema);

// Export the model
export default LiveSession;