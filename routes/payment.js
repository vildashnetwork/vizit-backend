import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import UserModel from "../models/Users.js";
import HouseOwerModel from "../models/HouseOwners.js";

dotenv.config();
const router = express.Router();

const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.NKWA_BASE_URL; // Your NKWA base URL

console.log("API KEY LOADED:", API_KEY ? "YES" : "NO");
console.log("BASE_URL LOADED:", BASE_URL ? "YES" : "NO");

/* -------------------- POST /pay -------------------- */
router.post("/pay", async (req, res) => {
    const { phoneNumber, amount, description, role, id } = req.body;

    // 1️⃣ Input validation
    if (!phoneNumber || !amount || !id || !role) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    if (!/^2376\d{8}$/.test(phoneNumber)) {
        return res.status(400).json({ message: "Invalid Cameroon phone number" });
    }

    if (Number(amount) < 50) {
        return res.status(400).json({ message: "Minimum payment is 50 FCFA" });
    }

    if (!API_KEY || !BASE_URL) {
        return res.status(500).json({ message: "Server misconfiguration: API_KEY or BASE_URL missing" });
    }

    try {
        // 2️⃣ Initiate the payment (user gets MTN pop-up)
        const response = await axios.post(
            `${BASE_URL}/collect`,
            {
                amount: Number(amount),
                phoneNumber,
                description: description || "Payment"
            },
            {
                headers: {
                    "X-API-Key": API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        // 3️⃣ Save as pending in MongoDB
        const Model = role === "owner" ? HouseOwerModel : UserModel;
        const transactionData = {
            ...response.data,
            status: "pending", // important: pending until confirmed by MTN
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const updatedUser = await Model.findOneAndUpdate(
            { _id: id },
            { $push: { paymentprscribtion: transactionData } },
            { new: true, upsert: true }
        );

        // 4️⃣ Send response to frontend (payment initiated)
        res.status(200).json({
            message: "Payment initiated. Waiting for user confirmation.",
            transaction: transactionData,
            user: updatedUser
        });

    } catch (err) {
        console.error("NKWA ERROR:", err.response?.data || err.message);
        res.status(err.response?.status || 500).json({
            message: "Payment initiation failed",
            error: err.response?.data || err.message
        });
    }
});

export default router;
