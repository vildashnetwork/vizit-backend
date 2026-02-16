
import mongoose from "mongoose"


const ResetPassSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        index: true
    },
    OTPcode: {
        type: String,
        required: true
    },
    // Auto-delete after 600 seconds (10 minutes)
    createdAt: {
        type: Date,
        expires: 600,
        default: Date.now
    }
}, { timestamps: true });

const OTP = mongoose.model("OTP", ResetPassSchema);
export default OTP;