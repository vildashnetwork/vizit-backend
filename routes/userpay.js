import express from "express";
import UserModel from "../models/UserModel.js";

const router = express.Router();

router.post("/subscribe-to-view", async (req, res) => {
    // Now expecting 'months' from the frontend (e.g., 1, 3, 6)
    const { userId, months } = req.body;

    const PRICE_PER_MONTH = 50; // Cost for 1 month
    const numMonths = parseInt(months) || 1; // Default to 1 month if not provided
    const totalCost = PRICE_PER_MONTH * numMonths;

    try {
        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // 1. Check if user has enough balance
        if (user.totalBalance < totalCost) {
            return res.status(400).json({
                message: `Insufficient balance. You need ${totalCost} XAF for ${numMonths} month(s).`
            });
        }

        // 2. Logic for Date Calculation
        const now = new Date();
        let newStartDate = now;
        let currentExpiry = user.paytoviewenddate;

        // Determine the base date to add months to
        // If they already have an active subscription, we add to the current end date
        let baseDate = (user.haspay && currentExpiry && currentExpiry > now)
            ? new Date(currentExpiry)
            : now;

        const newEndDate = new Date(baseDate);
        newEndDate.setMonth(newEndDate.getMonth() + numMonths);

        // 3. Update User Data
        user.totalBalance -= totalCost;
        user.haspay = true;
        user.paytoviewdetailstartdate = now; // Mark the last time they made a payment
        user.paytoviewenddate = newEndDate;

        // Log the transaction
        user.paymentprscribtion.push({
            amount: totalCost,
            status: "success",
            description: `Purchased ${numMonths} month(s) view access`,
            paymentType: "disbursement",
            verifiedAt: now
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

export default router;