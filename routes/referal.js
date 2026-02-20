import express from "express"
import HouseOwerModel from "../models/HouseOwners.js";
import UserModel from "../models/Users.js";

const router = express.Router()



//savin referal code when owner is approved and has a referal code

router.put("/save-referal/:id", async (req, res) => {
    try {
        const owner = await HouseOwerModel.findById(req.params.id);
        if (!owner) {
            return res.status(404).json({ message: "Owner not found" });
        }
        if (owner.status != "approved") {
            return res.status(400).json({ message: "Owner is not approved yet" });
        }
        if (owner.referredBy) {
            return res.status(400).json({ message: "Owner already has a referral code" });
        }
        const { referralCode } = req.body;
        const referrer = await UserModel.findOne({ _id: referralCode });
        if (!referrer) {
            return res.status(404).json({ message: "Referrer not found" });
        }
        owner.referredBy = referrer._id;
        await owner.save();
        res.status(200).json({ message: "Referral code saved successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }

})


// When Admin clicks "Approve"
const approveKYC = async (req, res) => {
    const owner = await HouseOwerModel.findById(req.params.id);

    if (owner.status != "approved") {
        return res.status(400).json({ message: "Owner is not approved yet" });
    }

    if (owner.referredBy && !owner.isReferralPaid) {
        const referrer = await UserModel.findById(owner.referredBy);
        if (referrer) {
            referrer.referalbalance += 50;
            owner.isReferralPaid = true;

            await referrer.save();
            await owner.save();
        }
    }
    res.json({ message: "Owner approved and referral paid" });
};


router.put("/approve/:id", approveKYC);






const NKWA_BASE_URL = process.env.NKWA_BASE_URL;
const NKWA_API_KEY = process.env.API_KEY;

router.post("/payments/:id", async (req, res) => {
    const { phone, amount } = req.body;
    const userId = req.params.id;

    // 1. Basic Input Validation
    if (!phone || !amount || amount <= 0) {
        return res.status(400).json({
            success: false,
            error: "Valid phone and amount are required"
        });
    }

    try {
        // 2. Fetch the user and check balance
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        // Ensure we handle the balance as a number
        const currentBalance = Number(user.referalbalance || 0);
        const withdrawAmount = parseInt(amount);

        if (currentBalance < withdrawAmount) {
            return res.status(400).json({
                success: false,
                error: `Insufficient balance. Available: ${currentBalance} frs`
            });
        }

        // 3. Call Nkwa API to disburse funds
        const response = await axios.post(
            `${NKWA_BASE_URL}/disburse`,
            {
                phoneNumber: String(phone),
                amount: withdrawAmount,
            },
            {
                headers: {
                    "X-API-Key": NKWA_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        // 4. If payment API is successful, deduct the balance
        // We use $inc with a negative value to ensure atomicity
        user.referalbalance = currentBalance - withdrawAmount;
        await user.save();

        // 5. Return success
        res.status(201).json({
            success: true,
            message: "Disbursement successful and balance updated",
            newBalance: user.referalbalance,
            data: response.data
        });

    } catch (err) {
        const statusCode = err.response?.status || 500;
        const errorData = err.response?.data || { message: err.message };

        console.error("Payment Process failed:", errorData);

        res.status(statusCode).json({
            success: false,
            error: errorData,
        });
    }
});

export default router;