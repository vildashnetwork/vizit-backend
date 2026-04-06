// server.js - With better network handling
import express from 'express';
import { PaymentOperation } from '@hachther/mesomb';
import dotenv from 'dotenv';
import https from 'https';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
app.use(express.json());

// Increase global timeout and add agent
const agent = new https.Agent({
    keepAlive: true,
    timeout: 30000,
    rejectUnauthorized: true
});

// Initialize MeSomb client with custom fetch options
const paymentClient = new PaymentOperation({
    applicationKey: process.env.MESOMB_APPLICATION_KEY,
    accessKey: process.env.MESOMB_ACCESS_KEY,
    secretKey: process.env.MESOMB_SECRET_KEY,
    language: 'en'
});

// Test network connectivity first
app.get('/api/test-network', async (req, res) => {
    try {
        // Test if we can reach MeSomb
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

// Payment endpoint with retry logic
app.post('/api/pay-me', async (req, res) => {
    try {
        const { phone, amount, service } = req.body;

        console.log('\n💰 User wants to deposit money:');
        console.log(`  User Phone: ${phone}`);
        console.log(`  Amount: ${amount} XAF`);
        console.log(`  Service: ${service}`);

        // Validate input
        if (!phone || !amount || !service) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: phone, amount, service'
            });
        }

        // Try with timeout and retry
        let response;
        let retries = 3;
        let lastError;

        while (retries > 0) {
            try {
                console.log(`Attempting payment (${retries} retries left)...`);

                // Create a promise with timeout
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
                break; // Success, exit retry loop

            } catch (error) {
                lastError = error;
                console.log(`Attempt failed: ${error.message}`);
                retries--;

                if (retries > 0) {
                    console.log(`Waiting 2 seconds before retry...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
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

        // Specific error messages for network issues
        if (error.message.includes('fetch failed') || error.message.includes('timeout')) {
            res.status(500).json({
                success: false,
                message: 'Network error: Cannot connect to MeSomb servers',
                error: error.message,
                solutions: [
                    'Check your internet connection',
                    'Try running: ping mesomb.hachther.com',
                    'Disable any VPN or proxy',
                    'Restart your network router',
                    'Try on a different network (mobile hotspot)'
                ]
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

// Alternative endpoint with offline fallback
app.post('/api/pay-offline', async (req, res) => {
    // For testing without network
    const { phone, amount, service } = req.body;

    console.log('⚠️ OFFLINE MODE: Simulating payment');

    // Simulate successful payment for testing
    res.json({
        success: true,
        message: '⚠️ OFFLINE MODE: Payment simulated (no real transaction)',
        simulated: true,
        data: { phone, amount, service },
        note: 'This is for testing only. Real payments require internet connection.'
    });
});

// Health check with network status
app.get('/health', async (req, res) => {
    let meSombStatus = 'unknown';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        await fetch('https://mesomb.hachther.com', {
            signal: controller.signal,
            method: 'HEAD'
        });

        clearTimeout(timeoutId);
        meSombStatus = 'reachable';
    } catch (error) {
        meSombStatus = 'unreachable';
    }

    res.json({
        status: 'OK',
        service: 'Payment Collection API',
        network: {
            meSombReachable: meSombStatus === 'reachable',
            status: meSombStatus
        },
        endpoints: {
            'POST /api/pay-me': 'Real payment (requires network)',
            'POST /api/pay-offline': 'Test payment (offline mode)',
            'GET /api/test-network': 'Test network connectivity'
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('\n========================================');
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('========================================');
    console.log('\n⚠️ FIRST, TEST YOUR NETWORK:');
    console.log(`  GET http://localhost:${PORT}/api/test-network`);
    console.log('\n💰 THEN TEST PAYMENT:');
    console.log(`  POST http://localhost:${PORT}/api/pay-me`);
    console.log('  Body: { "phone": "677550203", "amount": 100, "service": "MTN" }');
    console.log('\n📱 OR USE OFFLINE MODE FOR TESTING:');
    console.log(`  POST http://localhost:${PORT}/api/pay-offline`);
    console.log('========================================\n');

    // Quick network test on startup
    console.log('🔍 Testing network connectivity...');
    fetch('https://mesomb.hachther.com', { method: 'HEAD' })
        .then(() => console.log('✅ MeSomb server is reachable'))
        .catch(() => console.log('❌ Cannot reach MeSomb server - check your internet connection'));
});