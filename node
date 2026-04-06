// server.js - Fixed authentication issue
import express from 'express';
import { PaymentOperation } from '@hachther/mesomb';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// ========== VERIFY CREDENTIALS FIRST ==========
const APPLICATION_KEY = process.env.MESOMB_APPLICATION_KEY?.trim();
const ACCESS_KEY = process.env.MESOMB_ACCESS_KEY?.trim();
const SECRET_KEY = process.env.MESOMB_SECRET_KEY?.trim();

console.log('\n Checking MeSomb Credentials:');
console.log(`Application Key: ${APPLICATION_KEY ? '✓ Present (' + APPLICATION_KEY.substring(0, 10) + '...)' : '✗ Missing'}`);
console.log(`Access Key: ${ACCESS_KEY ? '✓ Present (' + ACCESS_KEY.substring(0, 10) + '...)' : '✗ Missing'}`);
console.log(`Secret Key: ${SECRET_KEY ? '✓ Present (' + SECRET_KEY.substring(0, 10) + '...)' : '✗ Missing'}`);

// Validate credentials format
if (!APPLICATION_KEY || !ACCESS_KEY || !SECRET_KEY) {
    console.error('\n ERROR: Missing MeSomb credentials in .env file');
    console.error('Please create a .env file with:');
    console.error('MESOMB_APPLICATION_KEY=your_application_key');
    console.error('MESOMB_ACCESS_KEY=your_access_key');
    console.error('MESOMB_SECRET_KEY=your_secret_key');
    console.error('\nGet your keys from: https://mesomb.hachther.com/en/account/developer/\n');
    process.exit(1);
}

// Validate key formats (MeSomb keys are usually UUIDs or long strings)
const isValidUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
const isValidLongString = (str) => str.length >= 20;

if (!isValidLongString(APPLICATION_KEY)) {
    console.warn(' Warning: Application key seems too short. Check if it\'s correct.');
}
if (!isValidLongString(ACCESS_KEY)) {
    console.warn(' Warning: Access key seems too short. Check if it\'s correct.');
}
if (!isValidLongString(SECRET_KEY)) {
    console.warn(' Warning: Secret key seems too short. Check if it\'s correct.');
}

// ========== INITIALIZE ME SOMB CLIENT ==========
let paymentClient;
try {
    paymentClient = new PaymentOperation({
        applicationKey: APPLICATION_KEY,
        accessKey: ACCESS_KEY,
        secretKey: SECRET_KEY,
        language: 'en'
    });
    console.log('\n MeSomb client initialized successfully\n');
} catch (error) {
    console.error('\n Failed to initialize MeSomb client:', error.message);
    console.error('Please check your credentials and try again.\n');
    process.exit(1);
}

// ========== TEST CREDENTIALS ENDPOINT ==========
app.get('/api/test-credentials', async (req, res) => {
    try {
        // Try to get application status - this tests if credentials work
        const status = await paymentClient.getStatus();
        res.json({
            success: true,
            message: 'Credentials are valid!',
            status: status
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid credentials',
            error: error.message,
            solution: 'Please verify your MeSomb credentials in .env file'
        });
    }
});

// ========== FIXED PAYMENT ENDPOINT ==========
app.post('/api/pay', async (req, res) => {
    try {
        const { phoneNumber, amount, service } = req.body;

        console.log('\n📱 Payment request received:');
        console.log(`  Phone: ${phoneNumber}`);
        console.log(`  Amount: ${amount} XAF`);
        console.log(`  Service: ${service}`);

        // Validate input
        if (!phoneNumber || !amount || !service) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: phoneNumber, amount, service'
            });
        }

        // Validate phone number (Cameroon format: 9 digits starting with 6)
        const phoneRegex = /^[6][0-9]{8}$/;
        if (!phoneRegex.test(phoneNumber.toString())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid phone number. Must be 9 digits starting with 6 (e.g., 677550203)'
            });
        }

        // Validate amount
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum < 50) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be at least 50 XAF'
            });
        }

        // Validate service
        const validServices = ['MTN', 'ORANGE', 'AIRTEL'];
        if (!validServices.includes(service.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: `Invalid service. Must be one of: ${validServices.join(', ')}`
            });
        }

        console.log('\n Initiating deposit to:', phoneNumber);

        // Make deposit with complete required fields
        const response = await paymentClient.makeDeposit({
            receiver: phoneNumber,
            amount: amountNum,
            service: service.toUpperCase(),
            country: 'CM',
            currency: 'XAF',
            conversion: false,
            customer: {
                email: `user_${Date.now()}@example.com`,
                first_name: 'Test',
                last_name: 'Customer',
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
                name: 'Mobile Payment',
                category: 'Transfer',
                quantity: 1,
                amount: amountNum
            }]
        });

        console.log('📤 Response received:', response);

        // Check response using proper methods
        const isSuccess = response.isOperationSuccess ? response.isOperationSuccess() : false;

        if (isSuccess) {
            res.json({
                success: true,
                message: 'Payment initiated successfully',
                transactionId: response.transaction?.pk,
                status: response.status,
                instruction: `A popup will appear on ${phoneNumber} to complete the payment`
            });
        } else {
            const errorMsg = response.message || response.raw?.message || 'Payment failed';
            res.json({
                success: false,
                message: errorMsg,
                status: response.status,
                suggestion: 'Verify the phone number is registered with ' + service.toUpperCase()
            });
        }

    } catch (error) {
        console.error('\n❌ Payment error details:', error);

        // Handle specific authentication error
        if (error.message && error.message.includes('authorization header')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication failed. Please check your MeSomb credentials.',
                error: error.message,
                solution: 'Go to https://mesomb.hachther.com/en/account/developer/ to get your keys'
            });
        }

        res.status(500).json({
            success: false,
            message: error.message || 'Payment processing failed',
            details: error.toString()
        });
    }
});

// ========== COLLECT MONEY ENDPOINT ==========
app.post('/api/collect', async (req, res) => {
    try {
        const { phoneNumber, amount, service } = req.body;

        console.log('\n💰 Collect request from:', phoneNumber);

        const response = await paymentClient.makeCollect({
            payer: phoneNumber,
            amount: parseFloat(amount),
            service: service.toUpperCase(),
            country: 'CM',
            currency: 'XAF',
            fees: true,
            conversion: false,
            customer: {
                email: `customer_${Date.now()}@example.com`,
                firstName: 'Test',
                lastName: 'Payer',
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
                name: 'Payment Collection',
                category: 'Service',
                quantity: 1,
                amount: parseFloat(amount)
            }]
        });

        const isSuccess = response.isOperationSuccess ? response.isOperationSuccess() : false;

        res.json({
            success: isSuccess,
            message: isSuccess ? 'Collection request sent' : (response.message || 'Collection failed'),
            transactionId: response.transaction?.pk,
            status: response.status
        });

    } catch (error) {
        console.error('Collect error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== HEALTH CHECK ==========
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'MeSomb Payment',
        credentialsConfigured: !!(APPLICATION_KEY && ACCESS_KEY && SECRET_KEY)
    });
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('\n========================================');
    console.log(` Server running on http://localhost:${PORT}`);
    console.log('========================================\n');
    console.log(' TEST YOUR CREDENTIALS FIRST:');
    console.log(`   GET http://localhost:${PORT}/api/test-credentials\n`);
    console.log(' THEN MAKE A PAYMENT:');
    console.log(`   POST http://localhost:${PORT}/api/pay`);
    console.log('   Body: { "phoneNumber": "677550203", "amount": 100, "service": "MTN" }\n');
    console.log('========================================\n');
});