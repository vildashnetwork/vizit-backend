import express from "express";
import HouseOwnerModel from "../models/HouseOwners.js";

const router = express.Router();

// ================= Submit KYC =================
router.post("/submit", async (req, res) => {
    try {
        const { userId, companyName, companyEmail, phone, address, idSnapshot, taxCardSnapshot, selfieWithId } = req.body;

        // Check if KYC already exists
        let kyc = await KYCModel.findOne({ userId });
        if (kyc) return res.status(400).json({ message: "KYC already submitted" });

        kyc = await KYCModel.create({
            userId,
            companyName,
            companyEmail,
            phone,
            address,
            idSnapshot,
            taxCardSnapshot,
            selfieWithId,
            status: "pending",
        });

        res.json({ message: "KYC submitted successfully", kyc });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// ================= Update Account Status =================
router.put("/status/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["pending", "approved", "rejected"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const kyc = await KYCModel.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!kyc) return res.status(404).json({ message: "KYC not found" });

        res.json({ message: "KYC status updated", kyc });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// ================= Get KYC by User =================
router.get("/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const kyc = await KYCModel.findOne({ userId });
        if (!kyc) return res.status(404).json({ message: "KYC not found" });
        res.json({ kyc });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
