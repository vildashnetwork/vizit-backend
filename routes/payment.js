// paymentRoutes.js - Complete Working MeSomb Integration (FIXED)
import express from "express";
import dotenv from "dotenv";
import UserModel from "../models/Users.js";
import HouseOwnerModel from "../models/HouseOwners.js";
import { PaymentOperation } from '@hachther/mesomb';
import crypto from 'crypto';
import https from 'https';
import fetch from 'node-fetch';  // ← CRITICAL: Missing import

dotenv.config();
const router = express.Router();

// ========== HTTPS AGENT FOR BETTER NETWORK HANDLING ==========
const agent = new https.Agent({
    keepAlive: true,
    timeout: 30000,
    rejectUnauthorized: true
});

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
        console.error('Required: MESOMB_APPLICATION_KEY, MESOMB_ACCESS_KEY, MESOMB_SECRET_KEY');
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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

// ========== NETWORK TEST ENDPOINT ==========
router.get("/test-network", async (req, res) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch('https://mesomb.hachther.com', {
            signal: controller.signal,
            agent: agent
        });

        clearTimeout(timeoutId);

        res.json({
            success: true,
            message: 'Network connection to MeSomb is working',
            status: response.status
        });
    } catch (error) {
        res.json({
            success: false,
            message: 'Cannot reach MeSomb servers',
            error: error.message,
            solutions: [
                'Check your internet connection',
                'Disable VPN/Proxy',
                'Check firewall settings',
                'Try on a different network'
            ]
        });
    }
});

// ========== PAYMENT ENDPOINT WITH RETRY LOGIC (FIXED) ==========
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

    if (amountNum > 500000) {
        return res.status(400).json({
            success: false,
            message: "Maximum payment is 500,000 FCFA"
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

        // Retry logic for network issues
        let response;
        let retries = 3;
        let lastError;

        while (retries > 0) {
            try {
                console.log(`Attempting payment (${retries} retries left)...`);

                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
                });

                // FIXED: Use camelCase field names (firstName, lastName) instead of snake_case (first_name, last_name)
                const paymentPromise = paymentClient.makeCollect({
                    payer: formattedPhone,
                    amount: amountNum,
                    service: service,
                    country: 'CM',
                    currency: 'XAF',
                    fees: true,
                    conversion: false,
                    customer: {
                        email: userExists.email || `${formattedPhone}@user.com`,
                        firstName: userExists.name?.split(' ')[0] || 'User',      // ← FIXED: firstName (camelCase)
                        lastName: userExists.name?.split(' ')[1] || 'Customer',   // ← FIXED: lastName (camelCase)
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

                response = await Promise.race([paymentPromise, timeoutPromise]);
                break;

            } catch (error) {
                lastError = error;
                console.log(`Attempt failed: ${error.message}`);
                retries--;

                if (retries > 0) {
                    console.log(`Waiting 2 seconds before retry...`);
                    await delay(2000);
                }
            }
        }

        if (!response) {
            throw lastError || new Error('All payment attempts failed');
        }

        console.log("MeSomb response received");

        const isSuccess = response.isOperationSuccess ? response.isOperationSuccess() : false;

        if (!isSuccess) {
            let errorMessage = response.message || "Transaction failed";

            if (errorMessage.includes("does not know the recipient")) {
                errorMessage = "Your merchant account is not properly configured. Please contact MeSomb support to activate your account for receiving payments.";
            } else if (errorMessage.includes("insufficient")) {
                errorMessage = "Insufficient funds in merchant account. Please contact support.";
            } else if (errorMessage.includes("timeout")) {
                errorMessage = "Payment request timed out. Please try again.";
            }

            return res.status(400).json({
                success: false,
                message: errorMessage,
                error: response.status,
                solution: "Verify your MeSomb merchant account is activated for collections"
            });
        }

        // Save transaction to database
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
        let statusCode = 500;

        if (errorMessage.includes("does not know the recipient")) {
            errorMessage = "Merchant account not configured. Please contact MeSomb support.";
            statusCode = 400;
        } else if (errorMessage.includes("fetch failed") || errorMessage.includes("timeout")) {
            errorMessage = "Network error: Cannot connect to payment service. Please try again.";
            statusCode = 503;
        }

        return res.status(statusCode).json({
            success: false,
            message: "Payment process failed",
            error: errorMessage
        });
    }
});

// ========== SIMPLE PAYMENT ENDPOINT (LIKE WORKING SERVER) ==========
router.post("/pay-me", async (req, res) => {
    try {
        const { phone, amount, service } = req.body;

        console.log('\n💰 User wants to deposit money:');
        console.log(`  User Phone: ${phone}`);
        console.log(`  Amount: ${amount} XAF`);
        console.log(`  Service: ${service}`);

        if (!phone || !amount || !service) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: phone, amount, service'
            });
        }

        let response;
        let retries = 3;
        let lastError;

        while (retries > 0) {
            try {
                console.log(`Attempting payment (${retries} retries left)...`);

                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
                });

                const paymentPromise = paymentClient.makeCollect({
                    payer: phone,
                    amount: parseFloat(amount),
                    service: service.toUpperCase(),
                    country: 'CM',
                    currency: 'XAF',
                    fees: true,
                    conversion: false,
                    customer: {
                        email: `user_${Date.now()}@example.com`,
                        firstName: 'User',
                        lastName: 'Customer',
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
                        name: 'Deposit to Merchant',
                        category: 'Payment',
                        quantity: 1,
                        amount: parseFloat(amount)
                    }]
                });

                response = await Promise.race([paymentPromise, timeoutPromise]);
                break;

            } catch (error) {
                lastError = error;
                console.log(`Attempt failed: ${error.message}`);
                retries--;
                if (retries > 0) await delay(2000);
            }
        }

        if (!response) {
            throw lastError || new Error('All payment attempts failed');
        }

        const isSuccess = response.isOperationSuccess ? response.isOperationSuccess() : false;

        if (isSuccess) {
            res.json({
                success: true,
                message: `Successfully collected ${amount} XAF from ${phone}`,
                transactionId: response.transaction?.pk,
                status: response.status,
                amountCollected: amount,
                user: phone,
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({
                success: false,
                message: response.message || 'Payment collection failed',
                status: response.status
            });
        }

    } catch (error) {
        console.error('❌ Collection error:', error);

        if (error.message.includes('fetch failed') || error.message.includes('timeout')) {
            res.status(500).json({
                success: false,
                message: 'Network error: Cannot connect to MeSomb servers',
                error: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message,
                details: error.toString()
            });
        }
    }
});

// ========== OFFLINE TEST MODE ==========
router.post("/pay-offline", async (req, res) => {
    const { phoneNumber, amount, role, id } = req.body;

    console.log('⚠️ OFFLINE MODE: Simulating payment');
    console.log('Request:', { phoneNumber, amount, role, id });

    res.json({
        success: true,
        message: '⚠️ OFFLINE MODE: Payment simulated (no real transaction)',
        simulated: true,
        data: { phoneNumber, amount, role, id },
        note: 'This is for testing only. Real payments require MeSomb configuration.'
    });
});

// ========== RECONCILE PENDING PAYMENTS ==========
router.get("/reconcile-payments", async (req, res) => {
    try {
        console.log('🔄 Starting reconciliation...');

        const results = { checked: 0, updated: 0, credited: 0, errors: 0 };
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

                            await model.updateOne({ _id: user._id }, updateQuery);
                            results.updated++;
                        }
                    } catch (err) {
                        console.error(`Failed to verify ${transaction.nkwaTransactionId}:`, err.message);
                        results.errors++;
                    }
                }
            }
        }

        res.status(200).json({ success: true, message: "Reconciliation complete", results });
    } catch (error) {
        console.error("Reconciliation error:", error);
        res.status(500).json({ success: false, message: "Reconciliation failed", error: error.message });
    }
});

// ========== CREDIT USER FOR SUCCESSFUL PAYMENTS ==========
router.post("/credit-user/:email", async (req, res) => {
    try {
        const { email } = req.params;

        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }

        let user = await UserModel.findOne({ email }) || await HouseOwnerModel.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
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
            console.log(`✅ Credited ${totalToAdd} XAF to ${email}`);
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
        return res.status(500).json({ success: false, message: "Credit process failed", error: error.message });
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
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const userData = user.toObject();
        delete userData.password;

        res.status(200).json({ success: true, user: { ...userData, role: role } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== HEALTH CHECK ==========
router.get("/payment-health", async (req, res) => {
    let meSombStatus = 'unknown';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        await fetch('https://mesomb.hachther.com', {
            signal: controller.signal,
            method: 'HEAD',
            agent: agent
        });

        clearTimeout(timeoutId);
        meSombStatus = 'reachable';
    } catch (error) {
        meSombStatus = 'unreachable';
    }

    res.json({
        success: true,
        status: 'OK',
        service: 'VIZIT Payment API',
        meSomb: {
            initialized: meSombInitialized,
            reachable: meSombStatus === 'reachable',
            status: meSombStatus
        }
    });
});

// ========== TEST ENDPOINT ==========
router.get("/test-payment", (req, res) => {
    res.json({
        success: true,
        message: "Payment routes are working!",
        meSombStatus: meSombInitialized ? "Connected" : "Not Connected",
        endpoints: {
            pay: "POST /api/pay",
            payMe: "POST /api/pay-me (simpler version)",
            payOffline: "POST /api/pay-offline",
            reconcile: "GET /api/reconcile-payments",
            credit: "POST /api/credit-user/:email",
            user: "GET /api/user/me/:email",
            debug: "GET /api/debug-mesomb",
            testNetwork: "GET /api/test-network",
            health: "GET /api/payment-health"
        },
        timestamp: new Date().toISOString()
    });
});

export default router;