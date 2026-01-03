import mongoose from "mongoose";

const ReelsSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true
        },

        postownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        caption: {
            type: String,
            required: true
        },

        likes: [
            {
                id: {
                    type: mongoose.Schema.Types.ObjectId,
                    required: true
                },

                name: {
                    type: String,
                    required: true
                },
                email: {
                    type: String,
                    required: true
                },
                profile: {
                    type: String,
                    required: true
                },
                date: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        comments: [
            {
                id: {
                    type: mongoose.Schema.Types.ObjectId,
                    required: true
                },
                name: {
                    type: String,
                    required: true
                },
                email: {
                    type: String,
                    required: true
                },
                profile: {
                    type: String,
                    required: true
                },
                text: {
                    type: String,
                    required: true
                },
                date: {
                    type: Date,
                    default: Date.now
                },
                likes: [
                    {
                        id: {
                            type: mongoose.Schema.Types.ObjectId,
                            required: true
                        },

                        time: {
                            type: Date,
                            default: Date.now
                        }
                    }
                ]
            }
        ],

        shares: [
            {
                id: {
                    type: mongoose.Schema.Types.ObjectId,
                    required: true
                },
                name: {
                    type: String,
                    required: true
                }
            }
        ],

        videoUrl: {
            type: String,
            required: true
        },

        avatar: {
            type: String,
            required: true
        }
    },
    { timestamps: true }
);

ReelsSchema.index({ createdAt: -1 });

const Reels = mongoose.model("reels", ReelsSchema);
export default Reels;
