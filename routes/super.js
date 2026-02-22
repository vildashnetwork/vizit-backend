import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import axios from "axios";
import AdminModel from "../models/AdminModel.js";
import decodeTokenFromReq from "./decode.js";

const router = express.Router();
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "your_super_secret_key";

/**
 * Helper: Send Welcome Email via Brevo
 */
const sendAdminWelcomeEmail = async (email, password, role) => {
    const apiKey = process.env.BREVO_API_KEY;
    const url = "https://api.brevo.com/v3/smtp/email";

    const emailContent = {
        sender: { name: "Vizit Admin Panel", email: process.env.SUPPORT_EMAIL },
        to: [{ email: email }],
        subject: "Your Vizit Admin Credentials",
        htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-top: 5px solid #244531;">
                <div style="background-color: #f9f9f9; padding: 20px; text-align: center;">
                    <h1 style="color: #244531; margin: 0;">Vizit Admin</h1>
                </div>
                <div style="padding: 30px; color: #333;">
                    <h2>Welcome to the Team</h2>
                    <p>You have been added as a <strong>${role}</strong> on the Vizit Dashboard.</p>
                    <p>Below are your temporary login credentials. Please keep them secure.</p>
                    
                    <div style="background: #f0fdf4; border: 1px solid #22c55e; padding: 15px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                        <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${password}</p>
                    </div>

                    <p style="margin-top: 20px;">You can log in at the Vizit Admin Portal. 
                    We recommend changing your password after your first login. use this link
                     <a href='https://dashboard.vizit.homes/'>https://dashboard.vizit.homes/</a> </p>
                </div>
                <div style="background: #244531; color: white; padding: 15px; text-align: center; font-size: 12px;">
                    © 2026 Vizit Properties. All rights reserved.
                </div>
            </div>
        `
    };

    return axios.post(url, emailContent, {
        headers: { "api-key": apiKey, "Content-Type": "application/json" }
    });
};

/* =====================================================
   1. ADD ADMIN & SEND EMAIL
   ===================================================== */
router.post("/add", async (req, res) => {
    const { name, email, role } = req.body;

    try {
        const existingAdmin = await AdminModel.findOne({ email });
        if (existingAdmin) return res.status(400).json({ message: "Admin already exists" });

        // Generate random 10-character password
        const generatedPassword = crypto.randomBytes(5).toString("hex");

        // Hash for DB storage
        const hashedPassword = await bcrypt.hash(generatedPassword, SALT_ROUNDS);

        const newAdmin = new AdminModel({
            name,
            email,
            password: hashedPassword,
            role,
            status: "active"
        });

        await newAdmin.save();

        // Send the plain text password via Brevo
        await sendAdminWelcomeEmail(email, generatedPassword, role);

        res.status(201).json({
            success: true,
            message: `Admin invited successfully. Credentials sent to ${email}`
        });
    } catch (error) {
        console.error("Add Admin Error:", error);
        res.status(500).json({ message: "Failed to create admin or send email" });
    }
});

/* =====================================================
   2. ADMIN LOGIN (JWT 1 Month)
   ===================================================== */
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const admin = await AdminModel.findOne({ email });
        if (!admin) return res.status(404).json({ message: "Admin not found" });

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

        const token = jwt.sign(
            { id: admin._id, role: admin.role },
            JWT_SECRET,
            { expiresIn: "30d" } // 1 month
        );

        res.status(200).json({
            success: true,
            token,
            admin: {
                id: admin._id,
                name: admin.name,
                email: admin.email,
                role: admin.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/* =====================================================
   3. GET ALL ADMINS
   ===================================================== */
router.get("/all", async (req, res) => {
    try {
        const admins = await AdminModel.find().select("-password").sort({ createdAt: -1 });
        res.status(200).json({ success: true, admins });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

/* =====================================================
   4. DELETE ADMIN
   ===================================================== */
router.delete("/delete/:id", async (req, res) => {
    try {
        const admin = await AdminModel.findById(req.params.id);
        if (!admin) return res.status(404).json({ message: "Admin not found" });

        if (admin.role === "super_admin") {
            const superCount = await AdminModel.countDocuments({ role: "super_admin" });
            if (superCount <= 1) return res.status(403).json({ message: "Cannot delete the last Super Admin" });
        }

        await AdminModel.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: "Admin removed" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// decode token and get admin
router.get("/decode/token/admin", async (req, res) => {
    try {
        const result = decodeTokenFromReq(req);
        if (!result || !result.ok) {
            return res.status(result?.status || 401).json({
                message: result?.message || "Failed to decode token"
            });
        }

        // FIX: Search by email because 'id' is missing in your seeker token
        const user = await AdminModel.findOne({ email: result.payload.email });

        if (!user) {
            return res.status(404).json({ message: "Admin not found" });
        }

        return res.status(200).json({ user: user });
    } catch (error) {
        console.error("Token decode error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


export default router;