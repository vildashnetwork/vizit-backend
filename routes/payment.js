// paymentRoutes.js - Refactored from NKWA to MeSomb
import express from "express";
import dotenv from "dotenv";
import UserModel from "../models/Users.js";
import HouseOwnerModel from "../models/HouseOwners.js";
import { PaymentOperation } from '@hachther/mesomb';
import crypto from 'crypto';

dotenv.config();
const router = express.Router();

// ========== ME SOMB CONFIGURATION ==========
const paymentClient = new PaymentOperation({
    applicationKey: process.env.MESOMB_APPLICATION_KEY,
    accessKey: process.env.MESOMB_ACCESS_KEY,
    secretKey: process.env.MESOMB_SECRET_KEY,
    language: 'en'
});

// Helper function to generate transaction ID
function generateTransactionId(prefix = 'txn') {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

// Helper function to validate Cameroon phone number
function validateCameroonPhone(phoneNumber) {
    return /^2376\d{8}$/.test(phoneNumber);
}

// ========== COLLECT PAYMENT (User pays you) ==========
router.post("/pay", async (req, res) => {
    const { phoneNumber, amount, description, role, id } = req.body;

    // ── Validate inputs ──
    if (!phoneNumber || !amount || !id || !role)
        return res.status(400).json({ message: "Missing required fields" });

    if (!validateCameroonPhone(phoneNumber))
        return res.status(400).json({ message: "Invalid phone number. Use format: 2376XXXXXXXX" });

    if (Number(amount) < 50)
        return res.status(400).json({ message: "Minimum payment is 50 FCFA" });

    try {
        const Model = role === "owner" ? HouseOwnerModel : UserModel;

        // ── Verify user exists before calling MeSomb ──
        const userExists = await Model.findById(id);
        if (!userExists)
            return res.status(404).json({ message: "User not found" });

        // Remove '237' prefix if present (MeSomb expects just the number without country code)
        let payerPhone = phoneNumber;
        if (payerPhone.startsWith('237')) {
            payerPhone = payerPhone.substring(3);
        }

        console.log("→ MeSomb collect request:", {
            amount: Number(amount),
            payer: payerPhone,
            service: determineService(payerPhone)
        });

        // ── Call MeSomb makeCollect ──
        const response = await paymentClient.makeCollect({
            payer: payerPhone,
            amount: Number(amount),
            service: determineService(payerPhone),
            country: 'CM',
            currency: 'XAF',
            fees: true,
            conversion: false,
            customer: {
                email: userExists.email || `${id}@user.com`,
                firstName: userExists.name?.split(' ')[0] || 'User',
                lastName: userExists.name?.split(' ')[1] || 'Customer',
                town: 'Douala',
                region: 'Littoral',
                country: 'CM',
                address: 'Customer Address'
            },
            location: {
                town: 'Douala',
                region: 'Littoral',
                country: 'CM'
            },
            products: [{
                name: description || 'Payment Collection',
                category: 'Service',
                quantity: 1,
                amount: Number(amount)
            }]
        });

        console.log("← MeSomb response:", response);

        const isSuccess = response.isOperationSuccess ? response.isOperationSuccess() : false;

        if (!isSuccess) {
            return res.status(500).json({
                message: "MeSomb did not return a successful transaction",
                error: response.message
            });
        }

        // ── Save transaction with same structure as NKWA ──
        const transaction = {
            nkwaTransactionId: response.transaction?.pk || generateTransactionId('mesomb'), // Keep field name for compatibility
            internalRef: response.transaction?.reference || generateTransactionId('ref'),
            merchantId: process.env.MESOMB_APPLICATION_KEY?.substring(0, 20),
            amount: response.transaction?.amount || Number(amount),
            currency: response.transaction?.currency || 'XAF',
            fee: response.transaction?.fees || 0,
            merchantPaidFee: false,
            phoneNumber: phoneNumber,
            telecomOperator: determineService(payerPhone),
            status: response.status || "pending",
            paymentType: "collection",
            description: description || "",
            added: "notadded",
            createdAt: new Date(),
            mesombResponse: response // Store full response for debugging
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
        console.error("✗ MeSomb /collect failed:", {
            httpStatus: err.response?.status,
            error: err.message
        });

        return res.status(500).json({
            message: "Payment process failed",
            error: err.message
        });
    }
});

// Helper to determine service provider based on phone number prefix
function determineService(phoneNumber) {
    const phone = phoneNumber.toString();
    if (phone.startsWith('6') || phone.startsWith('65') || phone.startsWith('67')) {
        return 'MTN';
    } else if (phone.startsWith('69')) {
        return 'ORANGE';
    } else if (phone.startsWith('68')) {
        return 'AIRTEL';
    }
    return 'MTN'; // Default
}

// ========== RECONCILE ALL PENDING PAYMENTS ==========
router.get("/reconcile-payments", async (req, res) => {
    try {
        const results = { checked: 0, updated: 0, credited: 0, errors: 0 };
        const models = [{ model: UserModel }, { model: HouseOwnerModel }];

        for (const { model } of models) {
            const users = await model.find({ "paymentprscribtion.status": "pending" });

            for (const user of users) {
                for (const transaction of user.paymentprscribtion || []) {
                    if (transaction.status !== "pending") continue;

                    results.checked++;

                    try {
                        // Get transaction status from MeSomb
                        const mesombStatus = await paymentClient.getTransactions([transaction.nkwaTransactionId]);
                        const paymentStatus = mesombStatus[0];

                        if (paymentStatus && paymentStatus.status !== transaction.status) {
                            const updateQuery = {
                                $set: {
                                    "paymentprscribtion.$.status": paymentStatus.status,
                                    "paymentprscribtion.$.updatedAt": new Date(),
                                    "paymentprscribtion.$.rawResponse": paymentStatus
                                }
                            };

                            // ONLY credit if it's a new success AND hasn't been added yet
                            if (paymentStatus.status === "SUCCESS" && transaction.added === "notadded") {
                                updateQuery.$inc = { totalBalance: paymentStatus.amount || transaction.amount };
                                updateQuery.$set["paymentprscribtion.$.added"] = "added";
                                updateQuery.$set["paymentprscribtion.$.verifiedAt"] = new Date();
                                results.credited++;
                            }

                            await model.updateOne(
                                { _id: user._id, "paymentprscribtion._id": transaction._id },
                                updateQuery
                            );
                            results.updated++;
                        }
                    } catch (err) {
                        console.error(`Failed to verify transaction ${transaction.nkwaTransactionId}:`, err.message);
                        results.errors++;
                    }
                }
            }
        }
        res.status(200).json({ message: "Reconciliation complete", results });
    } catch (error) {
        res.status(500).json({ message: "Reconciliation failed", error: error.message });
    }
});

// ========== FETCH ALL TRANSACTIONS FROM MESOMB ==========
router.get("/mesomb/all-transactions", async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;

        // Get application status and recent transactions
        const status = await paymentClient.getStatus();

        // Note: MeSomb doesn't have a direct "get all transactions" endpoint
        // You need to query by specific IDs or use webhooks
        // This returns application status instead
        return res.status(200).json({
            message: "Application status fetched",
            data: status,
            note: "For transaction history, please check your MeSomb dashboard or implement webhooks"
        });

    } catch (error) {
        console.error("Fetch MeSomb transactions error:", error.message);
        return res.status(500).json({
            message: "Failed to fetch MeSomb data",
            error: error.message
        });
    }
});

// ========== CREDIT SUCCESS PAYMENTS PER USER (BY EMAIL) ==========
router.post("/credit-user/:email", async (req, res) => {
    try {
        const { email } = req.params;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        // Check both models
        let user = await UserModel.findOne({ email }) || await HouseOwnerModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        let totalToAdd = 0;
        let updatedCount = 0;

        // Iterate payments safely
        for (const payment of user.paymentprscribtion || []) {
            if (payment.status === "SUCCESS" && payment.added === "notadded") {
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

// ========== ACTIVATE VERIFICATION FOR HOUSE OWNERS ==========
router.post("/activate-verification/:email", async (req, res) => {
    try {
        const { months } = req.body;
        const { email } = req.params;

        if (!months || months < 1) {
            return res.status(400).json({ message: "Invalid months selected" });
        }

        const baseFee = 5000;
        const monthlyFee = 400;
        const totalCost = baseFee + (months * monthlyFee);

        const user = await HouseOwnerModel.findOne({ email });

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

// ========== SUBSCRIBE TO VIEW PROPERTIES ==========
router.post("/subscribe-to-view", async (req, res) => {
    const { userId, months } = req.body;
    const PRICE_PER_MONTH = 50;
    const numMonths = parseInt(months) || 1;
    const totalCost = PRICE_PER_MONTH * numMonths;

    try {
        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.totalBalance < totalCost) {
            return res.status(400).json({
                message: `Insufficient balance. You need ${totalCost} XAF for ${numMonths} month(s).`
            });
        }

        const now = new Date();
        let currentExpiry = user.paytoviewenddate;
        let baseDate = (user.haspay && currentExpiry && currentExpiry > now)
            ? new Date(currentExpiry)
            : now;

        const newEndDate = new Date(baseDate);
        newEndDate.setMonth(newEndDate.getMonth() + numMonths);

        user.totalBalance -= totalCost;
        user.haspay = true;
        user.paytoviewdetailstartdate = now;
        user.paytoviewenddate = newEndDate;

        user.paymentprscribtion.push({
            amount: totalCost,
            status: "SUCCESS",
            description: `Purchased ${numMonths} month(s) view access`,
            paymentType: "disbursement",
            verifiedAt: now,
            added: "added",
            nkwaTransactionId: generateTransactionId('sub') // Keep field name
        });

        await user.save();

        res.status(200).json({
            message: `Successfully subscribed for ${numMonths} month(s)!`,
            newExpiry: user.paytoviewenddate,
            balanceRemaining: user.totalBalance
        });

    } catch (error) {
        console.error("Subscription Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ========== DISBURSE PAYMENT (Send money FROM you TO user) ==========
router.post("/payments", async (req, res) => {
    const { phone, amount } = req.body;

    if (!phone || !amount) {
        return res.status(400).json({
            success: false,
            error: "Phone and amount are required"
        });
    }

    // Remove '237' prefix if present
    let receiverPhone = phone.toString();
    if (receiverPhone.startsWith('237')) {
        receiverPhone = receiverPhone.substring(3);
    }

    try {
        const response = await paymentClient.makeDeposit({
            receiver: receiverPhone,
            amount: parseInt(amount),
            service: determineService(receiverPhone),
            country: 'CM',
            currency: 'XAF',
            conversion: false,
            customer: {
                email: 'disbursement@example.com',
                firstName: 'Disbursement',
                lastName: 'User',
                town: 'Douala',
                region: 'Littoral',
                country: 'CM',
                address: 'Disbursement Address'
            },
            location: {
                town: 'Douala',
                region: 'Littoral',
                country: 'CM'
            },
            products: [{
                name: 'Disbursement',
                category: 'Payment',
                quantity: 1,
                amount: parseInt(amount)
            }]
        });

        const isSuccess = response.isOperationSuccess ? response.isOperationSuccess() : false;

        res.status(isSuccess ? 201 : 400).json({
            success: isSuccess,
            data: {
                id: response.transaction?.pk,
                amount: response.transaction?.amount,
                status: response.status,
                phoneNumber: phone
            }
        });

    } catch (err) {
        console.error("MeSomb disbursement failed:", err.message);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ========== RECONCILE ALL PAYMENTS USING MESOMB ==========
router.get("/reconcile-all", async (req, res) => {
    try {
        const results = { checked: 0, updated: 0, credited: 0, errors: 0 };
        const models = [UserModel, HouseOwnerModel];

        for (const model of models) {
            const users = await model.find({ "paymentprscribtion.status": "pending" });

            for (const user of users) {
                for (const transaction of user.paymentprscribtion || []) {
                    if (transaction.status !== "pending") continue;
                    if (!transaction.nkwaTransactionId) continue;

                    results.checked++;

                    try {
                        const mesombTransactions = await paymentClient.getTransactions([transaction.nkwaTransactionId]);
                        const mesombPayment = mesombTransactions[0];

                        if (mesombPayment && mesombPayment.status !== transaction.status) {
                            const updateQuery = {
                                $set: {
                                    "paymentprscribtion.$.status": mesombPayment.status,
                                    "paymentprscribtion.$.updatedAt": new Date()
                                }
                            };

                            if (mesombPayment.status === "SUCCESS" && transaction.added !== "added") {
                                updateQuery.$inc = { totalBalance: mesombPayment.amount || transaction.amount };
                                updateQuery.$set["paymentprscribtion.$.added"] = "added";
                                results.credited++;
                            }

                            await model.updateOne(
                                { _id: user._id, "paymentprscribtion._id": transaction._id },
                                updateQuery
                            );
                            results.updated++;
                        }
                    } catch (err) {
                        console.error(`Reconcile failed for ID ${transaction.nkwaTransactionId}:`, err.message);
                        results.errors++;
                    }
                }
            }
        }

        res.status(200).json({
            success: true,
            message: "Reconciliation process finished",
            results
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== GET ALL TRANSACTIONS FROM DATABASE ==========
router.get("/all-transactions", async (req, res) => {
    try {
        const fetchFromModel = async (Model, roleLabel) => {
            return await Model.aggregate([
                { $match: { "paymentprscribtion.0": { $exists: true } } },
                { $unwind: "$paymentprscribtion" },
                {
                    $project: {
                        _id: 0,
                        transactionId: "$paymentprscribtion._id",
                        nkwaId: "$paymentprscribtion.nkwaTransactionId",
                        amount: "$paymentprscribtion.amount",
                        status: "$paymentprscribtion.status",
                        date: "$paymentprscribtion.createdAt",
                        ownerName: "$name",
                        ownerRole: roleLabel,
                        ownerId: "$_id"
                    }
                }
            ]);
        };

        const [userTransactions, ownerTransactions] = await Promise.all([
            fetchFromModel(UserModel, "User"),
            fetchFromModel(HouseOwnerModel, "HouseOwner")
        ]);

        const allTransactions = [...userTransactions, ...ownerTransactions].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
        );

        res.status(200).json({
            success: true,
            count: allTransactions.length,
            transactions: allTransactions
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== GET ALL USERS ==========
router.get("/allusers", async (req, res) => {
    try {
        const [users, owners] = await Promise.all([
            UserModel.find({}).select("-password"),
            HouseOwnerModel.find({}).select("-password")
        ]);

        const formattedUsers = users.map(u => ({
            ...u._doc,
            category: "Seeker",
            role: "user"
        }));

        const formattedOwners = owners.map(o => ({
            ...o._doc,
            category: "HouseOwner",
            role: "owner"
        }));

        const allPlatformUsers = [...formattedUsers, ...formattedOwners];

        res.status(200).json({
            success: true,
            total: allPlatformUsers.length,
            ownersCount: owners.length,
            seekersCount: users.length,
            users: allPlatformUsers
        });

    } catch (error) {
        console.error("Fetch All Users Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve platform users"
        });
    }
});

// ========== GET ALL USERS (ALTERNATIVE) ==========
router.get("/all-users", async (req, res) => {
    try {
        const [users, owners] = await Promise.all([
            UserModel.find({}).select("-password"),
            HouseOwnerModel.find({}).select("-password"),
        ]);

        const combined = [
            ...users.map((u) => ({ ...u._doc, collectionType: "user" })),
            ...owners.map((o) => ({ ...o._doc, collectionType: "houseowner" })),
        ];

        res.status(200).json({
            success: true,
            count: combined.length,
            users: combined,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== UPDATE USER STATUS ==========
router.patch("/update-status/:id", async (req, res) => {
    const { id } = req.params;
    const { accountstatus, reason, collectionType } = req.body;

    const validStatuses = ["active", "suspended", "ban", "deactivated", "review"];
    if (!validStatuses.includes(accountstatus)) {
        return res.status(400).json({
            success: false,
            message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
        });
    }

    try {
        let updatedUser = null;

        console.log(`[Admin Action] Updating ID: ${id} | Collection: ${collectionType} | Status: ${accountstatus}`);

        const isOwner = collectionType === "houseowner" || collectionType === "owner";

        if (isOwner) {
            updatedUser = await HouseOwnerModel.findByIdAndUpdate(
                id,
                { $set: { accountstatus, reason: reason || "No reason provided" } },
                { new: true, runValidators: true }
            );
        } else {
            updatedUser = await UserModel.findByIdAndUpdate(
                id,
                { $set: { accountstatus, reason: reason || "No reason provided" } },
                { new: true, runValidators: true }
            );
        }

        if (!updatedUser) {
            console.error(`[Error] User with ID ${id} not found`);
            return res.status(404).json({
                success: false,
                message: `Account not found in the database.`
            });
        }

        console.log(`[Success] ${updatedUser.email} is now ${accountstatus}`);
        res.status(200).json({
            success: true,
            message: `Account has been successfully set to ${accountstatus}`,
            data: updatedUser,
        });

    } catch (error) {
        console.error("[Fatal Error] Update Status failed:", error.message);
        res.status(500).json({
            success: false,
            message: "Internal Server Error: " + error.message
        });
    }
});

// ========== WEBHOOK FOR MESOMB PAYMENT CONFIRMATIONS ==========
router.post("/webhook/mesomb", async (req, res) => {
    try {
        const webhookData = req.body;
        console.log("Webhook received:", webhookData);

        // Process webhook and update transaction status
        const { transaction_id, status, amount, reference } = webhookData;

        // Find and update the transaction in your database
        // This depends on how you store your transactions

        res.status(200).json({ received: true });
    } catch (error) {
        console.error("Webhook error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ========== TEST MESOMB CONNECTION ==========
router.get("/test-mesomb", async (req, res) => {
    try {
        const status = await paymentClient.getStatus();
        res.json({
            success: true,
            message: "MeSomb connection successful",
            status: status
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "MeSomb connection failed",
            error: error.message
        });
    }
});

export default router;