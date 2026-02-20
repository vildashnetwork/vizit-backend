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
        const referrer = await UserModel.findOne({ referralCode });
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

export default router;