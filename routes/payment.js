// paymentRoutes.js - Complete Integrated MeSomb Payment System
import express from "express";
import dotenv from "dotenv";
import UserModel from "../models/Users.js";
import HouseOwnerModel from "../models/HouseOwners.js";
import { PaymentOperation } from '@hachther/mesomb';
import crypto from 'crypto';
import https from 'https';
import fetch from 'node-fetch';

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












router.post("/pay/owner", async (req, res) => {
    try {
        const { phoneNumber, amount, service, userId, userRole, email } = req.body;

        console.log('\n📱 User wants to deposit money:');
        console.log(`  User Phone: ${phoneNumber}`);
        console.log(`  Amount: ${amount} XAF`);
        console.log(`  Service: ${service}`);
        console.log(`  User ID: ${userId}`);
        console.log(`  User Role: ${userRole}`);

        // Validate required fields
        if (!phoneNumber || !amount || !service) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: phoneNumber, amount, service'
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing userId - cannot credit account without user identification'
            });
        }

        // Validate amount
        const amountNum = parseFloat(amount);
        if (amountNum < 50) {
            return res.status(400).json({
                success: false,
                message: 'Minimum payment is 50 FCFA'
            });
        }

        if (amountNum > 500000) {
            return res.status(400).json({
                success: false,
                message: 'Maximum payment is 500,000 FCFA'
            });
        }

        // Find the user in the correct model
        let Model = HouseOwnerModel;
        // let actualUserRole = userRole;

        // if (actualUserRole === 'owner' || actualUserRole === 'houseowner') {
        //     Model = HouseOwnerModel;
        // }

        const userExists = await Model.findById(userId);

        if (!userExists) {
            return res.status(404).json({
                success: false,
                message: 'User not found in database'
            });
        }

        // Process MeSomb payment
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
                    payer: phoneNumber,
                    amount: amountNum,
                    service: service.toUpperCase(),
                    country: 'CM',
                    currency: 'XAF',
                    fees: true,
                    conversion: false,
                    customer: {
                        email: userExists.email || email || `user_${Date.now()}@example.com`,
                        firstName: userExists.name?.split(' ')[0] || 'User',
                        lastName: userExists.name?.split(' ')[1] || 'Customer',
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
                        name: 'VIZIT Token Purchase',
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
                if (retries > 0) await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        if (!response) {
            throw lastError || new Error('All payment attempts failed');
        }

        const isSuccess = response.isOperationSuccess ? response.isOperationSuccess() : false;

        if (!isSuccess) {
            let errorMessage = response.message || 'Payment collection failed';

            if (errorMessage.includes("does not know the recipient")) {
                errorMessage = "Your merchant account is not properly configured. Please contact support.";
            }

            return res.status(400).json({
                success: false,
                message: errorMessage,
                status: response.status
            });
        }

        // ========== CREATE TRANSACTION RECORD MATCHING YOUR SCHEMA ==========
        const transactionId = generateTransactionId('pay');
        const formattedPhone = formatPhoneNumber(phoneNumber);

        // Convert service to lowercase for enum validation (mtn or orange)
        const telecomOperator = service.toLowerCase();
        if (!['mtn', 'orange'].includes(telecomOperator)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid telecom operator. Must be MTN or Orange'
            });
        }

        // Create transaction object matching paymentSchema exactly
        const transaction = {
            nkwaTransactionId: response.transaction?.pk || transactionId,
            internalRef: response.transaction?.reference || transactionId,
            merchantId: parseInt(response.application) || 12345, // Convert to Number as schema expects Number
            amount: amountNum,
            currency: 'XAF',
            fee: response.transaction?.fees || 0,
            merchantPaidFee: false,
            phoneNumber: formattedPhone,
            telecomOperator: telecomOperator, // Now 'mtn' or 'orange' (lowercase)
            status: "pending",
            added: "notadded",
            paymentType: "collection",
            description: "VIZIT token purchase",
            // Store the full response in rawResponse field (not meSombResponse)
            rawResponse: {
                transactionId: response.transaction?.pk,
                status: response.status,
                message: response.message,
                fullResponse: response
            }
        };

        // ========== SAVE TRANSACTION TO USER'S ACCOUNT ==========
        const updatedUser = await Model.findByIdAndUpdate(
            userId,
            {
                $push: { paymentprscribtion: transaction },
                // Don't increment balance yet - wait for webhook confirmation
            },
            { new: true }
        );

        console.log(`✅ Payment initiated for ${userExists.email}`);
        console.log(`   Transaction ID: ${transaction.nkwaTransactionId}`);
        console.log(`   Amount: ${amountNum} XAF`);

        // ========== RETURN SUCCESS RESPONSE ==========
        res.json({
            success: true,
            message: `Payment initiated successfully! ${amountNum} XAF will be added to your balance once confirmed.`,
            transactionId: response.transaction?.pk,
            status: response.status,
            amountCollected: amountNum,
            user: {
                id: userExists._id,
                email: userExists.email,
                name: userExists.name,
                currentBalance: updatedUser.totalBalance || 0
            },
            transaction: {
                id: transaction.nkwaTransactionId,
                amount: amountNum,
                status: "pending",
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Payment error:', error);

        if (error.message.includes('fetch failed') || error.message.includes('timeout')) {
            res.status(500).json({
                success: false,
                message: 'Network error: Cannot connect to payment service. Please try again.',
                error: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Payment processing failed',
                details: error.toString()
            });
        }
    }
});


// ========== SIMPLE PAYMENT ENDPOINT (WORKING VERSION) ==========
// ========== SIMPLE PAYMENT ENDPOINT (WORKING VERSION WITH DATABASE) ==========
// router.post("/pay-me", async (req, res) => {
//     try {
//         const { phone, amount, service, userId, userRole, email } = req.body;

//         console.log('\n User wants to deposit money:');
//         console.log(`  User Phone: ${phone}`);
//         console.log(`  Amount: ${amount} XAF`);
//         console.log(`  Service: ${service}`);
//         console.log(`  User ID: ${userId}`);
//         console.log(`  User Role: ${userRole}`);

//         // Validate required fields
//         if (!phone || !amount || !service) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Missing required fields: phone, amount, service'
//             });
//         }

//         if (!userId) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Missing userId - cannot credit account without user identification'
//             });
//         }

//         // Validate amount
//         const amountNum = parseFloat(amount);
//         if (amountNum < 50) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Minimum payment is 50 FCFA'
//             });
//         }

//         if (amountNum > 500000) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Maximum payment is 500,000 FCFA'
//             });
//         }

//         // Find the user in the correct model
//         let Model = UserModel;
//         let actualUserRole = userRole || 'user';

//         if (actualUserRole === 'owner' || actualUserRole === 'houseowner') {
//             Model = HouseOwnerModel;
//         }

//         const userExists = await Model.findById(userId);

//         if (!userExists) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'User not found in database'
//             });
//         }

//         // Process MeSomb payment
//         let response;
//         let retries = 3;
//         let lastError;

//         while (retries > 0) {
//             try {
//                 console.log(`Attempting payment (${retries} retries left)...`);

//                 const timeoutPromise = new Promise((_, reject) => {
//                     setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
//                 });

//                 const paymentPromise = paymentClient.makeCollect({
//                     payer: phone,
//                     amount: amountNum,
//                     service: service.toUpperCase(),
//                     country: 'CM',
//                     currency: 'XAF',
//                     fees: true,
//                     conversion: false,
//                     customer: {
//                         email: userExists.email || email || `user_${Date.now()}@example.com`,
//                         firstName: userExists.name?.split(' ')[0] || 'User',
//                         lastName: userExists.name?.split(' ')[1] || 'Customer',
//                         town: userExists.town || 'Douala',
//                         region: userExists.region || 'Littoral',
//                         country: 'CM',
//                         address: userExists.address || 'User Address'
//                     },
//                     location: {
//                         town: userExists.town || 'Douala',
//                         region: userExists.region || 'Littoral',
//                         country: 'CM'
//                     },
//                     products: [{
//                         name: 'VIZIT Token Purchase',
//                         category: 'Virtual Currency',
//                         quantity: 1,
//                         amount: amountNum
//                     }]
//                 });

//                 response = await Promise.race([paymentPromise, timeoutPromise]);
//                 break;

//             } catch (error) {
//                 lastError = error;
//                 console.log(`Attempt failed: ${error.message}`);
//                 retries--;
//                 if (retries > 0) await delay(2000);
//             }
//         }

//         if (!response) {
//             throw lastError || new Error('All payment attempts failed');
//         }

//         const isSuccess = response.isOperationSuccess ? response.isOperationSuccess() : false;

//         if (!isSuccess) {
//             let errorMessage = response.message || 'Payment collection failed';

//             if (errorMessage.includes("does not know the recipient")) {
//                 errorMessage = "Your merchant account is not properly configured. Please contact support.";
//             }

//             return res.status(400).json({
//                 success: false,
//                 message: errorMessage,
//                 status: response.status
//             });
//         }

//         // ========== CREATE TRANSACTION RECORD ==========
//         const transactionId = generateTransactionId('pay');
//         const formattedPhone = formatPhoneNumber(phone);

//         const transaction = {
//             nkwaTransactionId: response.transaction?.pk || transactionId,
//             internalRef: response.transaction?.reference || transactionId,
//             merchantId: response.application || 'VIZIT_MERCHANT',
//             amount: amountNum,
//             currency: 'XAF',
//             fee: response.transaction?.fees || 0,
//             merchantPaidFee: false,
//             phoneNumber: formattedPhone,
//             telecomOperator: service.toUpperCase(),
//             status: "pending",
//             added: "notadded",
//             paymentType: "collection",
//             description: "VIZIT token purchase",
//             createdAt: new Date(),
//             updatedAt: new Date(),
//             meSombResponse: {
//                 transactionId: response.transaction?.pk,
//                 status: response.status,
//                 message: response.message
//             }
//         };

//         // ========== SAVE TRANSACTION TO USER'S ACCOUNT ==========
//         const updatedUser = await Model.findByIdAndUpdate(
//             userId,
//             {
//                 $push: { paymentprscribtion: transaction },
//                 $inc: { totalBalance: 0 } // Don't add balance yet, wait for reconciliation
//             },
//             { new: true }
//         );

//         console.log(`✅ Payment initiated for ${userExists.email}`);
//         console.log(`   Transaction ID: ${transaction.nkwaTransactionId}`);
//         console.log(`   Amount: ${amountNum} XAF`);

//         // ========== RETURN SUCCESS RESPONSE ==========
//         res.json({
//             success: true,
//             message: `Payment initiated successfully! ${amountNum} XAF will be added to your balance once confirmed.`,
//             transactionId: response.transaction?.pk,
//             status: response.status,
//             amountCollected: amountNum,
//             user: {
//                 id: userExists._id,
//                 email: userExists.email,
//                 name: userExists.name,
//                 currentBalance: updatedUser.totalBalance || 0
//             },
//             transaction: {
//                 id: transaction.nkwaTransactionId,
//                 amount: amountNum,
//                 status: "pending",
//                 timestamp: new Date().toISOString()
//             }
//         });

//     } catch (error) {
//         console.error('❌ Payment error:', error);

//         if (error.message.includes('fetch failed') || error.message.includes('timeout')) {
//             res.status(500).json({
//                 success: false,
//                 message: 'Network error: Cannot connect to payment service. Please try again.',
//                 error: error.message
//             });
//         } else {
//             res.status(500).json({
//                 success: false,
//                 message: error.message || 'Payment processing failed',
//                 details: error.toString()
//             });
//         }
//     }
// });






router.post("/pay", async (req, res) => {
    try {
        const { phoneNumber, amount, service, userId, userRole, email } = req.body;

        console.log('\n📱 User wants to deposit money:');
        console.log(`  User Phone: ${phoneNumber}`);
        console.log(`  Amount: ${amount} XAF`);
        console.log(`  Service: ${service}`);
        console.log(`  User ID: ${userId}`);
        console.log(`  User Role: ${userRole}`);

        // Validate required fields
        if (!phoneNumber || !amount || !service) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: phoneNumber, amount, service'
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'Missing userId - cannot credit account without user identification'
            });
        }

        // Validate amount
        const amountNum = parseFloat(amount);
        if (amountNum < 50) {
            return res.status(400).json({
                success: false,
                message: 'Minimum payment is 50 FCFA'
            });
        }

        if (amountNum > 500000) {
            return res.status(400).json({
                success: false,
                message: 'Maximum payment is 500,000 FCFA'
            });
        }

        // Find the user in the correct model
        let Model = UserModel;
        let actualUserRole = userRole;

        if (actualUserRole === 'owner' || actualUserRole === 'houseowner') {
            Model = HouseOwnerModel;
        }

        const userExists = await Model.findById(userId);

        if (!userExists) {
            return res.status(404).json({
                success: false,
                message: 'User not found in database'
            });
        }

        // Process MeSomb payment
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
                    payer: phoneNumber,
                    amount: amountNum,
                    service: service.toUpperCase(),
                    country: 'CM',
                    currency: 'XAF',
                    fees: true,
                    conversion: false,
                    customer: {
                        email: userExists.email || email || `user_${Date.now()}@example.com`,
                        firstName: userExists.name?.split(' ')[0] || 'User',
                        lastName: userExists.name?.split(' ')[1] || 'Customer',
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
                        name: 'VIZIT Token Purchase',
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
                if (retries > 0) await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        if (!response) {
            throw lastError || new Error('All payment attempts failed');
        }

        const isSuccess = response.isOperationSuccess ? response.isOperationSuccess() : false;

        if (!isSuccess) {
            let errorMessage = response.message || 'Payment collection failed';

            if (errorMessage.includes("does not know the recipient")) {
                errorMessage = "Your merchant account is not properly configured. Please contact support.";
            }

            return res.status(400).json({
                success: false,
                message: errorMessage,
                status: response.status
            });
        }

        // ========== CREATE TRANSACTION RECORD MATCHING YOUR SCHEMA ==========
        const transactionId = generateTransactionId('pay');
        const formattedPhone = formatPhoneNumber(phoneNumber);

        // Convert service to lowercase for enum validation (mtn or orange)
        const telecomOperator = service.toLowerCase();
        if (!['mtn', 'orange'].includes(telecomOperator)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid telecom operator. Must be MTN or Orange'
            });
        }

        // Create transaction object matching paymentSchema exactly
        const transaction = {
            nkwaTransactionId: response.transaction?.pk || transactionId,
            internalRef: response.transaction?.reference || transactionId,
            merchantId: parseInt(response.application) || 12345, // Convert to Number as schema expects Number
            amount: amountNum,
            currency: 'XAF',
            fee: response.transaction?.fees || 0,
            merchantPaidFee: false,
            phoneNumber: formattedPhone,
            telecomOperator: telecomOperator, // Now 'mtn' or 'orange' (lowercase)
            status: "pending",
            added: "notadded",
            paymentType: "collection",
            description: "VIZIT token purchase",
            // Store the full response in rawResponse field (not meSombResponse)
            rawResponse: {
                transactionId: response.transaction?.pk,
                status: response.status,
                message: response.message,
                fullResponse: response
            }
        };

        // ========== SAVE TRANSACTION TO USER'S ACCOUNT ==========
        const updatedUser = await Model.findByIdAndUpdate(
            userId,
            {
                $push: { paymentprscribtion: transaction },
                // Don't increment balance yet - wait for webhook confirmation
            },
            { new: true }
        );

        console.log(`✅ Payment initiated for ${userExists.email}`);
        console.log(`   Transaction ID: ${transaction.nkwaTransactionId}`);
        console.log(`   Amount: ${amountNum} XAF`);

        // ========== RETURN SUCCESS RESPONSE ==========
        res.json({
            success: true,
            message: `Payment initiated successfully! ${amountNum} XAF will be added to your balance once confirmed.`,
            transactionId: response.transaction?.pk,
            status: response.status,
            amountCollected: amountNum,
            user: {
                id: userExists._id,
                email: userExists.email,
                name: userExists.name,
                currentBalance: updatedUser.totalBalance || 0
            },
            transaction: {
                id: transaction.nkwaTransactionId,
                amount: amountNum,
                status: "pending",
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Payment error:', error);

        if (error.message.includes('fetch failed') || error.message.includes('timeout')) {
            res.status(500).json({
                success: false,
                message: 'Network error: Cannot connect to payment service. Please try again.',
                error: error.message
            });
        } else {
            res.status(500).json({
                success: false,
                message: error.message || 'Payment processing failed',
                details: error.toString()
            });
        }
    }
});



// ========== RECONCILE AND UPDATE BALANCE (Call this after payment) ==========
router.post("/reconcile-user-balance", async (req, res) => {
    try {
        const { userId, userRole } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }

        let Model = UserModel;
        if (userRole === 'owner' || userRole === 'houseowner') {
            Model = HouseOwnerModel;
        }

        const user = await Model.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        let totalToAdd = 0;
        let updatedCount = 0;
        const updatedTransactions = [];

        // Find all successful but not yet credited transactions
        for (let i = 0; i < user.paymentprscribtion.length; i++) {
            const transaction = user.paymentprscribtion[i];

            if (transaction.status === "SUCCESS" && transaction.added === "notadded") {
                totalToAdd += transaction.amount;
                transaction.added = "added";
                transaction.verifiedAt = new Date();
                updatedCount++;
                updatedTransactions.push({
                    amount: transaction.amount,
                    transactionId: transaction.nkwaTransactionId,
                    date: transaction.createdAt
                });
            }
        }

        if (totalToAdd > 0) {
            user.totalBalance = (user.totalBalance || 0) + totalToAdd;
            await user.save();

            console.log(`✅ Credited ${totalToAdd} XAF to ${user.email}`);
            console.log(`   New balance: ${user.totalBalance} XAF`);
        }

        res.json({
            success: true,
            message: `Balance updated successfully!`,
            creditedAmount: totalToAdd,
            transactionsUpdated: updatedCount,
            newBalance: user.totalBalance,
            transactions: updatedTransactions
        });

    } catch (error) {
        console.error('Reconcile error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== CHECK TRANSACTION STATUS AND UPDATE BALANCE ==========
router.get("/check-transaction/:transactionId", async (req, res) => {
    try {
        const { transactionId } = req.params;
        const { userId, userRole } = req.query;

        if (!transactionId || !userId) {
            return res.status(400).json({
                success: false,
                message: 'Transaction ID and User ID are required'
            });
        }

        // Get transaction status from MeSomb
        const mesombTransactions = await paymentClient.getTransactions([transactionId]);
        const mesombPayment = mesombTransactions[0];

        if (!mesombPayment) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found'
            });
        }

        // Find user and update transaction status
        let Model = UserModel;
        if (userRole === 'owner' || userRole === 'houseowner') {
            Model = HouseOwnerModel;
        }

        const user = await Model.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Find and update the transaction
        let transactionIndex = -1;
        let transaction = null;

        for (let i = 0; i < user.paymentprscribtion.length; i++) {
            if (user.paymentprscribtion[i].nkwaTransactionId === transactionId) {
                transactionIndex = i;
                transaction = user.paymentprscribtion[i];
                break;
            }
        }

        if (transactionIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Transaction not found for this user'
            });
        }

        // Update transaction status if changed
        if (mesombPayment.status !== transaction.status) {
            user.paymentprscribtion[transactionIndex].status = mesombPayment.status;
            user.paymentprscribtion[transactionIndex].updatedAt = new Date();

            // If successful and not yet credited, add to balance
            if (mesombPayment.status === "SUCCESS" && transaction.added === "notadded") {
                user.paymentprscribtion[transactionIndex].added = "added";
                user.paymentprscribtion[transactionIndex].verifiedAt = new Date();
                user.totalBalance = (user.totalBalance || 0) + transaction.amount;
                await user.save();

                return res.json({
                    success: true,
                    message: `Payment successful! Added ${transaction.amount} XAF to your balance.`,
                    status: mesombPayment.status,
                    amountAdded: transaction.amount,
                    newBalance: user.totalBalance,
                    transaction: user.paymentprscribtion[transactionIndex]
                });
            }

            await user.save();
        }

        res.json({
            success: mesombPayment.status === "SUCCESS",
            status: mesombPayment.status,
            message: mesombPayment.status === "SUCCESS" ? "Payment completed successfully" : "Payment pending or failed",
            transaction: user.paymentprscribtion[transactionIndex],
            currentBalance: user.totalBalance
        });

    } catch (error) {
        console.error('Check transaction error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== GET USER BALANCE ==========
router.get("/balance/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.query;

        let Model = UserModel;
        if (role === 'owner' || role === 'houseowner') {
            Model = HouseOwnerModel;
        }

        const user = await Model.findById(userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get pending transactions count
        const pendingTransactions = user.paymentprscribtion?.filter(t => t.status === "pending").length || 0;
        const successfulTransactions = user.paymentprscribtion?.filter(t => t.status === "SUCCESS" && t.added === "added").length || 0;

        res.json({
            success: true,
            balance: user.totalBalance || 0,
            pendingTransactions: pendingTransactions,
            successfulTransactions: successfulTransactions,
            currency: 'XAF',
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== OFFLINE TEST MODE ==========
router.post("/pay-offline", async (req, res) => {
    const { phoneNumber, amount, description, role, id } = req.body;

    console.log('⚠️ OFFLINE MODE: Simulating payment');
    console.log('Request:', { phoneNumber, amount, role, id });

    const transaction = {
        nkwaTransactionId: `sim_${Date.now()}`,
        amount: Number(amount),
        status: "SIMULATED",
        added: "notadded",
        description: description || "Test payment",
        createdAt: new Date(),
        simulated: true
    };

    res.json({
        success: true,
        message: '⚠️ OFFLINE MODE: Payment simulated (no real transaction)',
        simulated: true,
        transaction: transaction,
        note: 'This is for testing only. Real payments require MeSomb merchant activation.'
    });
});

// ========== RECONCILE PENDING PAYMENTS ==========
router.get("/reconcile-payments", async (req, res) => {
    try {
        console.log('🔄 Starting reconciliation...');

        const results = { checked: 0, updated: 0, credited: 0, errors: 0 };
        const models = [
            { model: UserModel, name: 'User' },
            { model: HouseOwnerModel, name: 'HouseOwner' }
        ];

        for (const { model, name } of models) {
            const users = await model.find({ "paymentprscribtion.status": "pending" });
            console.log(`Found ${users.length} ${name}s with pending transactions`);

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
                                    [`paymentprscribtion.${i}.updatedAt`]: new Date(),
                                    [`paymentprscribtion.${i}.rawResponse`]: mesombPayment
                                }
                            };

                            if (mesombPayment.status === "SUCCESS" && transaction.added === "notadded") {
                                updateQuery.$inc = { totalBalance: mesombPayment.amount };
                                updateQuery.$set[`paymentprscribtion.${i}.added`] = "added";
                                updateQuery.$set[`paymentprscribtion.${i}.verifiedAt`] = new Date();
                                results.credited++;
                                console.log(`✅ Credited ${mesombPayment.amount} XAF to ${user.email}`);
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

        console.log(`Reconciliation complete: ${results.credited} credited, ${results.errors} errors`);
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

        let user = await UserModel.findOne({ email });
        let userType = 'user';

        if (!user) {
            user = await HouseOwnerModel.findOne({ email });
            userType = 'owner';
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        let totalToAdd = 0;
        let updatedCount = 0;
        const creditedTransactions = [];

        for (let i = 0; i < user.paymentprscribtion.length; i++) {
            const payment = user.paymentprscribtion[i];

            if (payment.status === "SUCCESS" && payment.added === "notadded") {
                totalToAdd += payment.amount;
                payment.added = "added";
                payment.verifiedAt = new Date();
                updatedCount++;
                creditedTransactions.push({
                    amount: payment.amount,
                    transactionId: payment.nkwaTransactionId,
                    date: payment.createdAt
                });
            }
        }

        if (totalToAdd > 0) {
            user.totalBalance = (user.totalBalance || 0) + totalToAdd;
            await user.save();
            console.log(`✅ Credited ${totalToAdd} XAF to ${email} (${updatedCount} transactions)`);
        }

        return res.status(200).json({
            success: true,
            message: "Credit process completed",
            creditedAmount: totalToAdd,
            transactionsUpdated: updatedCount,
            newBalance: user.totalBalance,
            userType: userType,
            transactions: creditedTransactions
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
            return res.status(404).json({ success: false, message: "User not found" });
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
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== GET USER TRANSACTIONS ==========
router.get("/user-transactions/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        let user = await UserModel.findById(userId);
        let userType = 'user';

        if (!user) {
            user = await HouseOwnerModel.findById(userId);
            userType = 'owner';
        }

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const transactions = (user.paymentprscribtion || [])
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.status(200).json({
            success: true,
            transactions: transactions,
            balance: user.totalBalance || 0,
            userType: userType
        });
    } catch (error) {
        console.error("Get transactions error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== GET ALL TRANSACTIONS (ADMIN) ==========
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
                        description: "$paymentprscribtion.description",
                        paymentType: "$paymentprscribtion.paymentType"
                    }
                },
                { $sort: { date: -1 } }
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
            userCount: userTransactions.length,
            ownerCount: ownerTransactions.length,
            transactions: allTransactions
        });

    } catch (error) {
        console.error("Get all transactions error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== GET ALL USERS (ADMIN) ==========
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
        console.error("Get all users error:", error);
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
        timestamp: new Date().toISOString(),
        meSomb: {
            initialized: meSombInitialized,
            reachable: meSombStatus === 'reachable',
            status: meSombStatus
        },
        database: {
            users: await UserModel.countDocuments(),
            houseOwners: await HouseOwnerModel.countDocuments()
        }
    });
});

// ========== TEST ENDPOINT ==========
router.get("/test-payment", (req, res) => {
    res.json({
        success: true,
        message: "Payment routes are working!",
        meSombStatus: meSombInitialized ? "Connected" : "Not Connected",
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
            pay: "POST /api/pay - Main payment endpoint",
            payMe: "POST /api/pay-me - Simple payment endpoint",
            payOffline: "POST /api/pay-offline - Test mode",
            reconcile: "GET /api/reconcile-payments",
            credit: "POST /api/credit-user/:email",
            user: "GET /api/user/me/:email",
            userTransactions: "GET /api/user-transactions/:userId",
            allTransactions: "GET /api/all-transactions",
            allUsers: "GET /api/all-users",
            debug: "GET /api/debug-mesomb",
            testNetwork: "GET /api/test-network",
            health: "GET /api/payment-health"
        },
        timestamp: new Date().toISOString()
    });
});

export default router;