import OTP from "../models/OTP.js";

import crypto from "crypto";
import AdminModel from "../models/AdminModel.js";
import axios from "axios";
import express from "express";
import bcrypt from "bcrypt";

const router = express.Router()
const SALT_ROUNDS = 10;

const sendBrevoEmail = async (email, otpCode) => {
    const apiKey = process.env.BREVO_API_KEY;
    const url = "https://api.brevo.com/v3/smtp/email";

    const emailContent = {
        sender: { name: "Vizit Support", email: process.env.SUPPORT_EMAIL },
        to: [{ email: email }],
        subject: "Your Vizit Password Reset Code",
        htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-top: 5px solid #244531;">
                <div style="background-color: #f9f9f9; padding: 20px; text-align: center;">
                    <h1 style="color: #244531; margin: 0;">Vizit</h1>
                </div>
                <div style="padding: 30px; color: #333;">
                    <h2>Reset Your Password</h2>
                    <p>Use the following code to reset your password. This code expires in 10 minutes.</p>
                    <div style="background: #f0fdf4; border: 1px dashed #22c55e; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #244531; letter-spacing: 5px;">
                        ${otpCode}
                    </div>
                    <p style="margin-top: 20px;">If you didn't request this, please ignore this email.</p>
                </div>
                <div style="background: #244531; color: white; padding: 15px; text-align: center; font-size: 12px;">
                    © 2026 Vizit Properties. All rights reserved.
                </div>
            </div>
        `
    };

    await axios.post(url, emailContent, {
        headers: { "api-key": apiKey, "Content-Type": "application/json" }
    });
};

export const requestPasswordReset = async (req, res) => {
    const { email } = req.body;

    try {
        // 1. Check both schemas  

        const userAccount = await AdminModel.findOne({ email });

        if (!userAccount) {
            return res.status(404).json({ message: "No account found with this email" });
        }

        // 2. Generate 6-digit OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        // 3. Save to OTP Database (Upsert: update if exists, else create)
        await OTP.findOneAndUpdate(
            { email },
            { OTPcode: otpCode },
            { upsert: true, new: true }
        );

        // 4. Send Email via Brevo
        await sendBrevoEmail(email, otpCode);

        res.status(200).json({ message: "OTP sent to your email" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const verifyAndResetPassword = async (req, res) => {
    const { email, otpCode, newPassword } = req.body;

    try {
        // 1. Verify OTP
        const otpRecord = await OTP.findOne({ email, OTPcode: otpCode });

        if (!otpRecord) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }




        // 2. Find who it belongs to
        let account = await AdminModel.findOne({ email })

        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

        account.password = hashedPassword;
        await account.save();

        // 4. Delete OTP from database
        await OTP.deleteOne({ email });

        res.status(200).json({ message: "Password updated successfully" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

router.post("/request-reset", requestPasswordReset);
router.post("/verify-reset", verifyAndResetPassword);

export default router;