import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import UserModel from "../models/Users.js";
import HouseOwerModel from "../models/HouseOwners.js";

dotenv.config();
const router = express.Router();

const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.NKWA_BASE_URL; // Make sure this is set in your .env

console.log("API KEY LOADED:", API_KEY ? "YES" : "NO");
console.log("BASE_URL LOADED:", BASE_URL ? "YES" : "NO");

/* -------------------- POST /pay -------------------- */
router.post("/pay", async (req, res) => {
    const { phoneNumber, amount, description, role, id } = req.body;

    // Input validation
    if (!phoneNumber || !amount || !id || !role) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    if (!/^2376\d{8}$/.test(phoneNumber)) {
        return res.status(400).json({ message: "Invalid Cameroon phone number" });
    }

    if (Number(amount) < 100) {
        return res.status(400).json({ message: "Minimum payment is 100 FCFA" });
    }

    if (!API_KEY || !BASE_URL) {
        return res.status(500).json({ message: "Server misconfiguration: API_KEY or BASE_URL missing" });
    }

    try {
        // Call NKWA API
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

        // Update MongoDB
        const Model = role === "owner" ? HouseOwerModel : UserModel;
        const updatedUser = await Model.findOneAndUpdate(
            { _id: id },
            { $push: { paymentprscribtion: response.data } },
            { new: true, upsert: true }
        );

        // Send success response
        res.status(201).json({
            message: "Payment successful",
            payment: response.data,
            user: updatedUser
        });
    } catch (err) {
        console.error("NKWA ERROR:", err.response?.data || err.message);
        res.status(err.response?.status || 500).json({
            message: "Payment failed",
            error: err.response?.data || err.message
        });
    }
});

export default router;
