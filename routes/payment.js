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

// Helper function to generate unique transaction ID
function generateTransactionId(prefix = 'txn') {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

// Helper function to validate Cameroon phone number
function validateCameroonPhone(phoneNumber) {
    // Remove any spaces or special characters
    const cleanPhone = phoneNumber.toString().replace(/\D/g, '');
    // Check if it's a valid Cameroon number (6XXXXXXXX or 2376XXXXXXXX)
    const phoneRegex = /^(237)?[6][0-9]{8}$/;
    return phoneRegex.test(cleanPhone);
}

function formatPhoneNumber(phoneNumber) {
    // Remove any non-digit characters
    let clean = phoneNumber.toString().replace(/\D/g, '');
    // Remove 237 prefix if present (Cameroon country code)
    if (clean.startsWith('237')) {
        clean = clean.substring(3);
    }
    return clean;
}

// ========== PAYMENT ENDPOINT (COLLECT MONEY FROM USER) ==========
router.post("/pay", async (req, res) => {
    const { phoneNumber, amount, description, role, id } = req.body;

    // ── Validate inputs ──
    if (!phoneNumber || !amount || !id || !role) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    if (!validateCameroonPhone(phoneNumber)) {
        return res.status(400).json({ message: "Invalid phone number. Use format: 6XXXXXXXX or 2376XXXXXXXX" });
    }

    if (Number(amount) < 50) {
        return res.status(400).json({ message: "Minimum payment is 50 FCFA" });
    }

    try {
        const Model = role === "owner" ? HouseOwnerModel : UserModel;

        // ── Verify user exists before calling MeSomb ──
        const userExists = await Model.findById(id);
        if (!userExists) {
            return res.status(404).json({ message: "User not found" });
        }

        const formattedPhone = formatPhoneNumber(phoneNumber);
        const transactionId = generateTransactionId('pay');

        console.log("→ MeSomb collect request:", {
            amount: Number(amount),
            phoneNumber: formattedPhone,
            transactionId
        });

        // Determine service based on phone number prefix (Cameroon)
        let service = 'MTN'; // Default
        if (formattedPhone.startsWith('65') || formattedPhone.startsWith('67')) {
            service = 'ORANGE';
        } else if (formattedPhone.startsWith('68')) {
            service = 'AIRTEL';
        }

        // ── Call MeSomb to collect money from user ──
        const response = await paymentClient.makeCollect({
            payer: formattedPhone,
            amount: Number(amount),
            service: service,
            country: 'CM',
            currency: 'XAF',
            fees: true,
            conversion: false,
            customer: {
                email: userExists.email || `${formattedPhone}@user.com`,
                first_name: userExists.name?.split(' ')[0] || 'User',
                last_name: userExists.name?.split(' ')[1] || formattedPhone,
                town: userExists.town || 'Douala',
                region: userExists.region || 'Littoral',
                country: 'CM',
                address: userExists.address || 'User Address'
            },
            location: {
                town: userExists.town || 'Douala',
                region: userExists.region || 'Littoral',
                country: 'CM'
            },
            products: [{
                name: description || 'Payment Collection',
                category: 'Payment',
                quantity: 1,
                amount: Number(amount)
            }]
        });

        console.log("← MeSomb response:", response);

        const isSuccess = response.isOperationSuccess ? response.isOperationSuccess() : false;

        if (!isSuccess) {
            return res.status(500).json({
                message: "Payment failed",
                error: response.message || "Transaction failed"
            });
        }

        const mesombData = {
            id: response.transaction?.pk || transactionId,
            internalRef: response.transaction?.reference || transactionId,
            merchantId: response.application,
            amount: response.transaction?.amount || amount,
            currency: response.transaction?.currency || 'XAF',
            fee: response.transaction?.fees || 0,
            merchantPaidFee: false,
            phoneNumber: formattedPhone,
            telecomOperator: service,
            status: response.status || "pending",
            paymentType: "collection",
            description: description || "Payment collection"
        };

        // ── Save transaction to user's paymentprscribtion array ──
        const transaction = {
            nkwaTransactionId: mesombData.id,  // Keep same field name for compatibility
            internalRef: mesombData.internalRef,
            merchantId: mesombData.merchantId,
            amount: mesombData.amount,
            currency: mesombData.currency,
            fee: mesombData.fee,
            merchantPaidFee: mesombData.merchantPaidFee,
            phoneNumber: mesombData.phoneNumber,
            telecomOperator: mesombData.telecomOperator,
            status: "pending", // MeSomb transactions start as pending
            added: "notadded",
            paymentType: mesombData.paymentType,
            description: mesombData.description,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await Model.findByIdAndUpdate(
            id,
            { $push: { paymentprscribtion: transaction } },
            { new: true }
        );

        return res.status(201).json({
            message: "Payment initiated successfully",
            transaction: transaction
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
                    if (!transaction.nkwaTransactionId) continue;

                    results.checked++;

                    try {
                        // Get transaction status from MeSomb
                        const mesombTransactions = await paymentClient.getTransactions([transaction.nkwaTransactionId]);
                        const mesombPayment = mesombTransactions[0];

                        if (mesombPayment && mesombPayment.status !== transaction.status) {
                            const updateQuery = {
                                $set: {
                                    "paymentprscribtion.$.status": mesombPayment.status,
                                    "paymentprscribtion.$.updatedAt": new Date(),
                                    "paymentprscribtion.$.rawResponse": mesombPayment
                                }
                            };

                            // ONLY credit if it's a new success AND hasn't been added yet
                            if (mesombPayment.status === "SUCCESS" && transaction.added === "notadded") {
                                updateQuery.$inc = { totalBalance: mesombPayment.amount };
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

// ========== FETCH ALL TRANSACTIONS FROM ME SOMB ==========
router.get("/nkwa/all-transactions", async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;

        // Note: MeSomb doesn't have a direct get all transactions endpoint
        // We need to get transactions from our database instead
        const models = [UserModel, HouseOwnerModel];
        let allTransactions = [];

        for (const model of models) {
            const users = await model.find({ "paymentprscribtion.0": { $exists: true } });

            for (const user of users) {
                for (const transaction of user.paymentprscribtion || []) {
                    allTransactions.push({
                        id: transaction.nkwaTransactionId,
                        amount: transaction.amount,
                        status: transaction.status,
                        phoneNumber: transaction.phoneNumber,
                        telecomOperator: transaction.telecomOperator,
                        description: transaction.description,
                        createdAt: transaction.createdAt,
                        updatedAt: transaction.updatedAt
                    });
                }
            }
        }

        // Paginate results
        const start = (Number(page) - 1) * Number(limit);
        const paginatedTransactions = allTransactions.slice(start, start + Number(limit));

        return res.status(200).json({
            message: "Transactions fetched successfully",
            count: paginatedTransactions.length,
            total: allTransactions.length,
            data: {
                data: paginatedTransactions,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total: allTransactions.length,
                    pages: Math.ceil(allTransactions.length / Number(limit))
                }
            }
        });

    } catch (error) {
        console.error("Fetch transactions error:", error.message);
        return res.status(500).json({
            message: "Failed to fetch transactions",
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

// ========== ACTIVATE VERIFICATION (HOUSE OWNER) ==========
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

// ========== SUBSCRIBE TO VIEW (USERS) ==========
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
            nkwaTransactionId: generateTransactionId('sub'),
            amount: totalCost,
            status: "SUCCESS",
            added: "added",
            description: `Purchased ${numMonths} month(s) view access`,
            paymentType: "disbursement",
            verifiedAt: now,
            createdAt: now
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

// ========== DISBURSE MONEY TO USER (WITHDRAWAL) ==========
router.post("/payments", async (req, res) => {
    const { phone, amount } = req.body;

    if (!phone || !amount) {
        return res.status(400).json({
            success: false,
            error: "Phone and amount are required"
        });
    }

    if (!validateCameroonPhone(phone)) {
        return res.status(400).json({
            success: false,
            error: "Invalid phone number format"
        });
    }

    try {
        const formattedPhone = formatPhoneNumber(phone);

        let service = 'MTN';
        if (formattedPhone.startsWith('65') || formattedPhone.startsWith('67')) {
            service = 'ORANGE';
        } else if (formattedPhone.startsWith('68')) {
            service = 'AIRTEL';
        }

        const response = await paymentClient.makeDeposit({
            receiver: formattedPhone,
            amount: Number(amount),
            service: service,
            country: 'CM',
            currency: 'XAF',
            conversion: false,
            customer: {
                email: `user_${formattedPhone}@example.com`,
                first_name: 'User',
                last_name: formattedPhone,
                town: 'Douala',
                region: 'Littoral',
                country: 'CM',
                address: 'User Address'
            },
            location: {
                town: 'Douala',
                region: 'Littoral',
                country: 'CM'
            },
            products: [{
                name: 'Withdrawal',
                category: 'Cashout',
                quantity: 1,
                amount: Number(amount)
            }]
        });

        const isSuccess = response.isOperationSuccess ? response.isOperationSuccess() : false;

        if (!isSuccess) {
            return res.status(500).json({
                success: false,
                error: response.message || "Disbursement failed"
            });
        }

        res.status(201).json({
            success: true,
            data: {
                id: response.transaction?.pk,
                amount: amount,
                phoneNumber: formattedPhone,
                status: response.status
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

// ========== RECONCILE ALL (USING ME SOMB) ==========
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
                                updateQuery.$inc = { totalBalance: mesombPayment.amount };
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
                        ownerId: "$_id",
                        phoneNumber: "$paymentprscribtion.phoneNumber",
                        description: "$paymentprscribtion.description"
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

export default router; 