import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import UserModel from "../models/Users.js";
import HouseOwerModel from "../models/HouseOwners.js";

dotenv.config();
const router = express.Router();

const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.NKWA_BASE_URL;

/* -------------------- POST /pay -------------------- */
router.post("/pay", async (req, res) => {
    const { phoneNumber, amount, description, role, id } = req.body;

    if (!phoneNumber || !amount || !id || !role) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    if (!/^2376\d{8}$/.test(phoneNumber)) {
        return res.status(400).json({ message: "Invalid Cameroon phone number" });
    }

    if (Number(amount) < 50) {
        return res.status(400).json({ message: "Minimum payment is 50 FCFA" });
    }

    try {
        // 1️⃣ Initiate payment
        const initiate = await axios.post(
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

        const nkwaData = initiate.data;

        const Model = role === "owner" ? HouseOwerModel : UserModel;

        // 2️⃣ Save as pending
        await Model.updateOne(
            { _id: id },
            {
                $push: {
                    paymentprscribtion: {
                        ...nkwaData,
                        nkwaTransactionId: nkwaData.id,
                        status: "pending"
                    }
                }
            }
        );

        // 3️⃣ Wait 10 seconds then verify payment
        setTimeout(async () => {
            try {
                const verify = await axios.get(
                    `${BASE_URL}/payments/${nkwaData.id}`,
                    {
                        headers: { "X-API-Key": API_KEY }
                    }
                );

                const finalStatus = verify.data.status;

                // 4️⃣ Update transaction status
                await Model.updateOne(
                    {
                        _id: id,
                        "paymentprscribtion.nkwaTransactionId": nkwaData.id
                    },
                    {
                        $set: {
                            "paymentprscribtion.$.status": finalStatus,
                            "paymentprscribtion.$.updatedAt": new Date()
                        }
                    }
                );

                console.log("Payment verified:", finalStatus);

            } catch (error) {
                console.error("Verification failed:", error.message);
            }
        }, 10000); // 10 seconds delay

        return res.status(200).json({
            message: "Payment initiated. Awaiting confirmation.",
            transactionId: nkwaData.id
        });

    } catch (err) {
        console.error("Payment error:", err.response?.data || err.message);
        return res.status(500).json({
            message: "Payment initiation failed",
            error: err.response?.data || err.message
        });
    }
});

export default router;
