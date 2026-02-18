import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            default: "Pending Invite",
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            // Optional initially if you're using an invitation link system
            required: function () { return this.status === 'active'; }
        },
        role: {
            type: String,
            enum: ["super_admin", "admin", "moderator"],
            default: "admin",
        },
        status: {
            type: String,
            enum: ["active", "invited", "suspended"],
            default: "invited",
        },
        invitationToken: {
            type: String,
            default: null, // Used for the "accept invite" flow
        },
        lastLogin: {
            type: Date,
        },
    },
    {
        timestamps: true // This automatically gives you 'createdAt' (which is your 'addedOn' field)
    }
);

// Virtual to format the date exactly as shown in your mockData: "Jan 1, 2026"
adminSchema.virtual("addedOn").get(function () {
    return this.createdAt.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
});

// Ensure virtuals are included when converting to JSON for the frontend
adminSchema.set("toJSON", { virtuals: true });

const AdminModel = mongoose.model("admin", adminSchema);

export default AdminModel;