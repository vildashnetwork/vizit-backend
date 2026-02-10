import express from "express"
import axios from "axios"
import dotenv from "dotenv"
import UserModel from "../models/Users.js";
import HouseOwerModel from "../models/HouseOwners.js";

dotenv.config()
const router = express.Router()
const API_KEY = process.env.API_KEY

console.log("API KEY LOADED:", API_KEY ? "YES" : "NO");





router.post("/pay", async (req, res) => {
    const { phoneNumber, amount, description, role, id } = req.body;

    try {
        const response = await axios.post(
            `${BASE_URL}/collect`,
            {
                amount: Number(amount),
                phoneNumber: phoneNumber,
                description: description || "Payment"
            },
            {
                headers: {
                    "X-API-Key": API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        if (role === "owner") {
            // Update HouseOwners collection
            await HouseOwerModel.findOneAndUpdate(
                { _id: id },
                { $push: { paymentprscribtion: response.data } },
                { new: true, upsert: true }
            );
        } else {
            // Update Users collection
            await UserModel.findOneAndUpdate(
                { _id: id },
                { $push: { paymentprscribtion: response.data } },
                { new: true, upsert: true }
            );
        }


        res.status(201).json(response.data);
    } catch (err) {
        console.error("NKWA ERROR:", err.response?.data || err.message);
        res.status(err.response?.status || 500).json(err.response?.data);
    }
});

export default router