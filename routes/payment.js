// paymentRoutes.js - Complete Corrected MeSomb Integration
import express from "express";
import dotenv from "dotenv";
import UserModel from "../models/Users.js";
import HouseOwnerModel from "../models/HouseOwners.js";
import { PaymentOperation } from '@hachther/mesomb';
import crypto from 'crypto';

dotenv.config();
const router = express.Router();

// ========== ME SOMB CONFIGURATION WITH ERROR HANDLING ==========
let paymentClient = null;
let meSombInitialized = false;

try {
    if (process.env.MESOMB_APPLICATION_KEY && 
        process.env.MESOMB_ACCESS_KEY && 
        process.env.MESOMB_SECRET_KEY) {
        
        paymentClient = new PaymentOperation({
            applicationKey: process.env.MESOMB_APPLICATION_KEY,
            accessKey: process.env.MESOMB_ACCESS_KEY,
            secretKey: process.env.MESOMB_SECRET_KEY,
            language: 'en'
        });
        meSombInitialized = true;
        console.log('✅ MeSomb payment client initialized');
    } else {
        console.error('❌ MeSomb credentials missing');
    }
} catch (error) {
    console.error('❌ MeSomb init error:', error.message);
}

// ========== HELPER FUNCTIONS ==========
function generateTransactionId(prefix = 'txn') {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function validateCameroonPhone(phoneNumber) {
    const cleanPhone = phoneNumber.toString().replace(/\D/g, '');
    const phoneRegex = /^(237)?[6][0-9]{8}$/;
    return phoneRegex.test(cleanPhone);
}

function formatPhoneNumber(phoneNumber) {
    let clean = phoneNumber.toString().replace(/\D/g, '');
    if (clean.startsWith('237')) {
        clean = clean.substring(3);
    }
    return clean;
}

function getServiceFromPhone(phoneNumber) {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (formattedPhone.startsWith('65') || formattedPhone.startsWith('67')) {
        return 'ORANGE';
    } else if (formattedPhone.startsWith('68')) {
        return 'AIRTEL';
    }
    return 'MTN';
}

// ========== DEBUG ENDPOINT - CHECK ME SOMB STATUS ==========
router.get("/debug-mesomb", async (req, res) => {
    try {
        if (!meSombInitialized || !paymentClient) {
            return res.json({
                success: false,
                message: "MeSomb client not initialized",
                solution: "Check your environment variables: MESOMB_APPLICATION_KEY, MESOMB_ACCESS_KEY, MESOMB_SECRET_KEY",
                credentials: {
                    applicationKey: process.env.MESOMB_APPLICATION_KEY ? "✓ Present" : "✗ Missing",
                    accessKey: process.env.MESOMB_ACCESS_KEY ? "✓ Present" : "✗ Missing",
                    secretKey: process.env.MESOMB_SECRET_KEY ? "✓ Present" : "✗ Missing"
                }
            });
        }

        const status = await paymentClient.getStatus();
        res.json({
            success: true,
            message: "MeSomb connection successful",
            status: status,
            environment: process.env.NODE_ENV
        });
    } catch (error) {
        res.json({
            success: false,
            message: "MeSomb connection failed",
            error: error.message,
            solution: "Contact MeSomb support to activate your merchant account for collections"
        });
    }
});

// ========== PAYMENT ENDPOINT (COLLECT MONEY FROM USER) ==========
router.post("/pay", async (req, res) => {
    const { phoneNumber, amount, description, role, id } = req.body;

    console.log("📱 Payment request:", { phoneNumber, amount, role, id });

    // Validate inputs
    if (!phoneNumber || !amount || !id || !role) {
        return res.status(400).json({ 
            success: false,
            message: "Missing required fields: phoneNumber, amount, id, role" 
        });
    }

    if (!validateCameroonPhone(phoneNumber)) {
        return res.status(400).json({ 
            success: false,
            message: "Invalid phone number. Use format: 6XXXXXXXX or 2376XXXXXXXX" 
        });
    }

    const amountNum = Number(amount);
    if (amountNum < 50) {
        return res.status(400).json({ 
            success: false,
            message: "Minimum payment is 50 FCFA" 
        });
    }

    if (!meSombInitialized || !paymentClient) {
        return res.status(503).json({ 
            success: false,
            message: "Payment system not configured. Please contact support.",
            solution: "Check MeSomb credentials in environment variables"
        });
    }

    try {
        const Model = role === "owner" ? HouseOwnerModel : UserModel;
        const userExists = await Model.findById(id);
        
        if (!userExists) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }

        const formattedPhone = formatPhoneNumber(phoneNumber);
        const transactionId = generateTransactionId('pay');
        const service = getServiceFromPhone(formattedPhone);

        console.log(`💰 Processing: ${amountNum} XAF from ${formattedPhone} (${service})`);

        // IMPORTANT: makeCollect collects money FROM the user TO your merchant account
        // Your merchant account must be properly configured in MeSomb dashboard
        const response = await paymentClient.makeCollect({
            payer: formattedPhone,  // User paying
            amount: amountNum,
            service: service,
            country: 'CM',
            currency: 'XAF',
            fees: true,
            conversion: false,
            customer: {
                email: userExists.email || `${formattedPhone}@user.com`,
                first_name: userExists.name?.split(' ')[0] || 'User',
                last_name: userExists.name?.split(' ')[1] || 'Customer',
                town: userExists.town || 'Douala',
                region: userExists.region || 'Littoral',
                country: 'CM',
                address: userExists.address || 'Customer Address'
            },
            location: {
                town: userExists.town || 'Douala',
                region: userExists.region || 'Littoral',
                country: 'CM'
            },
            products: [{
                name: description || 'VIZIT Token Purchase',
                category: 'Virtual Currency',
                quantity: 1,
                amount: amountNum
            }]
        });

        console.log("MeSomb response received");

        const isSuccess = response.isOperationSuccess ? response.isOperationSuccess() : false;
        
        if (!isSuccess) {
            // Handle specific error about recipient
            let errorMessage = response.message || "Transaction failed";
            if (errorMessage.includes("does not know the recipient")) {
                errorMessage = "Your merchant account is not properly configured. Please contact support to activate your account for receiving payments.";
            }
            
            return res.status(400).json({
                success: false,
                message: errorMessage,
                error: response.status,
                solution: "Verify your MeSomb merchant account is activated for collections"
            });
        }

        // Save transaction
        const transaction = {
            nkwaTransactionId: response.transaction?.pk || transactionId,
            internalRef: response.transaction?.reference || transactionId,
            merchantId: response.application,
            amount: amountNum,
            currency: 'XAF',
            fee: response.transaction?.fees || 0,
            merchantPaidFee: false,
            phoneNumber: formattedPhone,
            telecomOperator: service,
            status: "pending",
            added: "notadded",
            paymentType: "collection",
            description: description || "VIZIT token purchase",
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await Model.findByIdAndUpdate(
            id,
            { $push: { paymentprscribtion: transaction } },
            { new: true }
        );

        return res.status(201).json({
            success: true,
            message: "Payment initiated successfully",
            transaction: {
                id: transaction.nkwaTransactionId,
                amount: transaction.amount,
                status: transaction.status,
                phoneNumber: transaction.phoneNumber
            }
        });

    } catch (err) {
        console.error("❌ Payment error:", err);
        
        let errorMessage = err.message;
        if (errorMessage.includes("does not know the recipient")) {
            errorMessage = "Merchant account not configured. Please contact support.";
        }
        
        return res.status(500).json({
            success: false,
            message: "Payment process failed",
            error: errorMessage
        });
    }
});

// ========== RECONCILE PENDING PAYMENTS ==========
router.get("/reconcile-payments", async (req, res) => {
    try {
        console.log('🔄 Starting reconciliation...');
        
        const results = { 
            checked: 0, 
            updated: 0, 
            credited: 0, 
            errors: 0 
        };
        
        const models = [UserModel, HouseOwnerModel];

        for (const model of models) {
            const users = await model.find({ "paymentprscribtion.status": "pending" });

            for (const user of users) {
                for (let i = 0; i < user.paymentprscribtion.length; i++) {
                    const transaction = user.paymentprscribtion[i];
                    
                    if (transaction.status !== "pending") continue;
                    if (!transaction.nkwaTransactionId) continue;

                    results.checked++;

                    try {
                        if (!meSombInitialized || !paymentClient) {
                            throw new Error('MeSomb not initialized');
                        }

                        const mesombTransactions = await paymentClient.getTransactions([transaction.nkwaTransactionId]);
                        const mesombPayment = mesombTransactions[0];

                        if (mesombPayment && mesombPayment.status !== transaction.status) {
                            const updateQuery = {
                                $set: {
                                    [`paymentprscribtion.${i}.status`]: mesombPayment.status,
                                    [`paymentprscribtion.${i}.updatedAt`]: new Date()
                                }
                            };

                            if (mesombPayment.status === "SUCCESS" && transaction.added === "notadded") {
                                updateQuery.$inc = { totalBalance: mesombPayment.amount };
                                updateQuery.$set[`paymentprscribtion.${i}.added`] = "added";
                                updateQuery.$set[`paymentprscribtion.${i}.verifiedAt`] = new Date();
                                results.credited++;
                            }

                            await model.updateOne(
                                { _id: user._id },
                                updateQuery
                            );
                            results.updated++;
                        }
                    } catch (err) {
                        console.error(`Failed to verify ${transaction.nkwaTransactionId}:`, err.message);
                        results.errors++;
                    }
                }
            }
        }
        
        res.status(200).json({ 
            success: true,
            message: "Reconciliation complete", 
            results 
        });
    } catch (error) {
        console.error("Reconciliation error:", error);
        res.status(500).json({ 
            success: false,
            message: "Reconciliation failed", 
            error: error.message 
        });
    }
});

// ========== CREDIT USER FOR SUCCESSFUL PAYMENTS ==========
router.post("/credit-user/:email", async (req, res) => {
    try {
        const { email } = req.params;

        if (!email) {
            return res.status(400).json({ 
                success: false,
                message: "Email is required" 
            });
        }

        let user = await UserModel.findOne({ email }) || await HouseOwnerModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }

        let totalToAdd = 0;
        let updatedCount = 0;

        for (const payment of user.paymentprscribtion || []) {
            if (payment.status === "SUCCESS" && payment.added === "notadded") {
                totalToAdd += payment.amount;
                payment.added = "added";
                payment.verifiedAt = new Date();
                updatedCount++;
            }
        }

        if (totalToAdd > 0) {
            user.totalBalance = (user.totalBalance || 0) + totalToAdd;
            await user.save();
        }

        return res.status(200).json({
            success: true,
            message: "Credit process completed",
            creditedAmount: totalToAdd,
            transactionsUpdated: updatedCount,
            newBalance: user.totalBalance
        });

    } catch (error) {
        console.error("Credit error:", error);
        return res.status(500).json({ 
            success: false,
            message: "Credit process failed", 
            error: error.message 
        });
    }
});

// ========== GET USER BY EMAIL ==========
router.get("/user/me/:email", async (req, res) => {
    try {
        const { email } = req.params;
        
        let user = await UserModel.findOne({ email });
        let role = 'user';
        
        if (!user) {
            user = await HouseOwnerModel.findOne({ email });
            role = 'owner';
        }
        
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }
        
        const userData = user.toObject();
        delete userData.password;
        
        res.status(200).json({
            success: true,
            user: {
                ...userData,
                role: role
            }
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            message: error.message 
        });
    }
});

// ========== ACTIVATE VERIFICATION (HOUSE OWNER) ==========
router.post("/activate-verification/:email", async (req, res) => {
    try {
        const { months } = req.body;
        const { email } = req.params;

        if (!months || months < 1) {
            return res.status(400).json({ 
                success: false,
                message: "Invalid months selected" 
            });
        }

        const baseFee = 5000;
        const monthlyFee = 400;
        const totalCost = baseFee + (months * monthlyFee);

        const user = await HouseOwnerModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }

        if ((user.totalBalance || 0) < totalCost) {
            return res.status(400).json({
                success: false,
                message: "Insufficient balance"
            });
        }

        const now = new Date();
        const expiry = new Date();
        expiry.setMonth(expiry.getMonth() + months);

        user.totalBalance -= totalCost;
        user.verified = true;
        user.verificationbalance = months;
        user.dateofverification = now;
        user.verificationexpirydate = expiry;

        await user.save();

        res.status(200).json({
            success: true,
            message: "Verification activated successfully",
            expiry,
            remainingBalance: user.totalBalance
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            success: false,
            message: "Server error" 
        });
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
            return res.status(404).json({ 
                success: false,
                message: "User not found" 
            });
        }

        if ((user.totalBalance || 0) < totalCost) {
            return res.status(400).json({
                success: false,
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
            success: true,
            message: `Successfully subscribed for ${numMonths} month(s)!`,
            newExpiry: user.paytoviewenddate,
            balanceRemaining: user.totalBalance
        });

    } catch (error) {
        console.error("Subscription Error:", error);
        res.status(500).json({ 
            success: false,
            message: "Internal server error" 
        });
    }
});

// ========== DISBURSE MONEY TO USER (WITHDRAWAL) ==========
router.post("/payments", async (req, res) => {
    const { phone, amount } = req.body;

    if (!phone || !amount) {
        return res.status(400).json({
            success: false,
            message: "Phone and amount are required"
        });
    }

    if (!validateCameroonPhone(phone)) {
        return res.status(400).json({
            success: false,
            message: "Invalid phone number format"
        });
    }

    if (!meSombInitialized || !paymentClient) {
        return res.status(503).json({
            success: false,
            message: "Payment system not available"
        });
    }

    try {
        const formattedPhone = formatPhoneNumber(phone);
        const service = getServiceFromPhone(formattedPhone);

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
            return res.status(400).json({
                success: false,
                message: response.message || "Disbursement failed"
            });
        }

        res.status(200).json({
            success: true,
            message: "Disbursement successful",
            data: {
                id: response.transaction?.pk,
                amount: amount,
                phoneNumber: formattedPhone,
                status: response.status
            }
        });

    } catch (err) {
        console.error("Disbursement failed:", err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
});

// ========== GET ALL TRANSACTIONS ==========
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
                        ownerEmail: "$email",
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

        const allTransactions = [...userTransactions, ...ownerTransactions]
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        res.status(200).json({
            success: true,
            count: allTransactions.length,
            transactions: allTransactions
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// ========== GET ALL USERS ==========
router.get("/all-users", async (req, res) => {
    try {
        const [users, owners] = await Promise.all([
            UserModel.find({}).select("-password"),
            HouseOwnerModel.find({}).select("-password"),
        ]);

        const combined = [
            ...users.map((u) => ({ 
                ...u._doc, 
                collectionType: "user",
                role: "seeker"
            })),
            ...owners.map((o) => ({ 
                ...o._doc, 
                collectionType: "houseowner",
                role: "owner"
            })),
        ];

        res.status(200).json({
            success: true,
            count: combined.length,
            users: combined,
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
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
        const isOwner = collectionType === "houseowner" || collectionType === "owner";

        if (isOwner) {
            updatedUser = await HouseOwnerModel.findByIdAndUpdate(
                id,
                { $set: { accountstatus, reason: reason || "No reason provided" } },
                { new: true, runValidators: true }
            ).select("-password");
        } else {
            updatedUser = await UserModel.findByIdAndUpdate(
                id,
                { $set: { accountstatus, reason: reason || "No reason provided" } },
                { new: true, runValidators: true }
            ).select("-password");
        }

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "Account not found in the database."
            });
        }

        res.status(200).json({
            success: true,
            message: `Account has been successfully set to ${accountstatus}`,
            data: updatedUser,
        });

    } catch (error) {
        console.error("Update status error:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error: " + error.message
        });
    }
});

// ========== TEST ENDPOINT ==========
router.get("/test-payment", (req, res) => {
    res.json({
        success: true,
        message: "Payment routes are working!",
        meSombStatus: meSombInitialized ? "Connected" : "Not Connected",
        endpoints: {
            pay: "POST /api/pay",
            reconcile: "GET /api/reconcile-payments",
            credit: "POST /api/credit-user/:email",
            user: "GET /api/user/me/:email",
            debug: "GET /api/debug-mesomb"
        }
    });
});

export default router;