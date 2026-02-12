import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import UserModel from "../models/Users.js";
import HouseOwnerModel from "../models/HouseOwners.js";

dotenv.config();
const router = express.Router();

const API_KEY = process.env.API_KEY;
const BASE_URL = process.env.NKWA_BASE_URL; // https://api.pay.staging.mynkwa.com




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
        const Model = role === "owner" ? HouseOwnerModel : UserModel;

        // 🔹 Call NKWA FIRST
        const response = await axios.post(
            `${BASE_URL}/collect`,
            {
                amount: Number(amount),
                phoneNumber,
                description: description || "collection"
            },
            {
                headers: {
                    "X-API-Key": API_KEY,
                    "Content-Type": "application/json"
                }
            }
        );

        const nkwaData = response.data;

        // 🚨 Extra safety check
        if (!nkwaData?.id) {
            return res.status(500).json({
                message: "NKWA did not return transaction ID"
            });
        }

        const transaction = {
            nkwaTransactionId: nkwaData.id,
            internalRef: nkwaData.internalRef,
            merchantId: nkwaData.merchantId,
            amount: nkwaData.amount,
            currency: nkwaData.currency,
            fee: nkwaData.fee,
            merchantPaidFee: nkwaData.merchantPaidFee,
            phoneNumber: nkwaData.phoneNumber,
            telecomOperator: nkwaData.telecomOperator,
            status: nkwaData.status || "pending",
            paymentType: nkwaData.paymentType,
            description: nkwaData.description
        };

        await Model.findByIdAndUpdate(
            id,
            { $push: { paymentprscribtion: transaction } },
            { new: true }
        );

        return res.status(201).json({
            message: "Payment initiated successfully",
            transaction
        });

    } catch (err) {
        console.error("Payment process failed:", err.response?.data || err.message);

        return res.status(500).json({
            message: "Payment process failed",
            error: err.response?.data || err.message
        });
    }
});













/* =========================================================
   RECONCILE ALL PENDING PAYMENTS
========================================================= */
router.get("/reconcile-payments", async (req, res) => {
    try {
        const results = {
            checked: 0,
            updated: 0,
            credited: 0,
            errors: 0
        };

        const models = [
            { model: UserModel, name: "User" },
            { model: HouseOwnerModel, name: "HouseOwner" }
        ];

        for (const { model } of models) {
            // Find users that have at least one pending transaction
            const users = await model.find({
                "paymentprscribtion.status": "pending"
            });

            for (const user of users) {
                // Iterate payments safely
                for (const transaction of user.paymentprscribtion || []) {
                    if (transaction.status !== "pending") continue;

                    results.checked++;

                    try {
                        // Fetch latest status from NKWA
                        const response = await axios.get(
                            `${BASE_URL}/payments/${transaction.nkwaTransactionId}`,
                            { headers: { "X-API-Key": API_KEY } }
                        );

                        const nkwaPayment = response.data;
console.log(nkwaPayment)
                        // Update only if status changed
                        if (nkwaPayment.status !== transaction.status) {

                            const updateQuery = {
                                $set: {
                                    "paymentprscribtion.$.status": nkwaPayment.status,
                                    "paymentprscribtion.$.updatedAt": new Date(),
                                    "paymentprscribtion.$.rawResponse": nkwaPayment
                                }
                            };

                            // Credit balance if success and not already credited
                            if (nkwaPayment.status === "success") {
                                updateQuery.$inc = { totalBalance: nkwaPayment.amount };
                                results.credited++;
                            }

                            await model.updateOne(
                                {
                                    _id: user._id,
                                    "paymentprscribtion._id": transaction._id
                                },
                                updateQuery
                            );

                            results.updated++;
                        }

                    } catch (err) {
                        console.error(
                            `Failed to verify transaction ${transaction.nkwaTransactionId}`,
                            err.response?.data || err.message
                        );
                        results.errors++;
                    }
                }
            }
        }

        return res.status(200).json({
            message: "Reconciliation complete",
            results
        });

    } catch (error) {
        console.error("Reconciliation error:", error.message);
        return res.status(500).json({
            message: "Reconciliation failed",
            error: error.message
        });
    }
});
















/* =========================================================
   FETCH ALL TRANSACTIONS FROM NKWA
========================================================= */
router.get("/nkwa/all-transactions", async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;

        if (!process.env.API_KEY || !process.env.NKWA_BASE_URL) {
            return res.status(500).json({
                message: "NKWA environment variables not configured"
            });
        }

        const response = await axios.get(
            `${process.env.NKWA_BASE_URL}/payments`,
            {
                params: {
                    page: Number(page),
                    limit: Number(limit)
                },
                headers: {
                    "X-API-Key": process.env.API_KEY
                }
            }
        );

        return res.status(200).json({
            message: "Transactions fetched successfully",
            count: response.data?.data?.length || 0,
            data: response.data
        });

    } catch (error) {
        console.error(
            "Fetch NKWA transactions error:",
            error.response?.data || error.message
        );

        return res.status(500).json({
            message: "Failed to fetch NKWA transactions",
            error: error.response?.data || error.message
        });
    }
});





/* =========================================================
   CREDIT SUCCESS PAYMENTS PER USER (BY EMAIL)
========================================================= */
router.post("/credit-user/:email", async (req, res) => {
    try {
        const { email } = req.params;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        // Check both models
        let user =
            await UserModel.findOne({ email }) ||
            await HouseOwnerModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        let totalToAdd = 0;
        let updatedCount = 0;

        // Iterate payments safely
        for (const payment of user.paymentprscribtion || []) {

            if (
                payment.status === "success" &&
                payment.added === "notadded"
            ) {
                totalToAdd += payment.amount;

                payment.added = "added";
                payment.verifiedAt = new Date();

                updatedCount++;
            }
        }

        // Only update if needed
        if (totalToAdd > 0) {
            user.totalBalance += totalToAdd;
            await user.save();
        }

        return res.status(200).json({
            message: "Credit process completed",
            creditedAmount: totalToAdd,
            transactionsUpdated: updatedCount,
            newBalance: user.totalBalance
        });

    } catch (error) {
        console.error("Credit error:", error.message);

        return res.status(500).json({
            message: "Credit process failed",
            error: error.message
        });
    }
});

















router.post("/activate-verification/:email", async (req, res) => {
    try {
        const { months } = req.body;
        const { email } = req.params;

        if (!months || months < 1) {
            return res.status(400).json({ message: "Invalid months selected" });
        }

        const baseFee = 50;
        const monthlyFee = 50;

        const totalCost = baseFee + (months * monthlyFee);

        const user = await HouseOwerModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.totalBalance < totalCost) {
            return res.status(400).json({
                message: "Insufficient balance"
            });
        }

        // Calculate expiry date
        const now = new Date();
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + months);

        // Deduct balance & activate
        user.totalBalance -= totalCost;
        user.verified = true;
        user.verificationbalance = months;
        user.dateofverification = now;
        user.verificationexpirydate = expiry;

        await user.save();

        res.status(200).json({
            message: "Verification activated successfully",
            expiry,
            remainingBalance: user.totalBalance
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
});


export default router;
