import express from "express";
import HouseOwnerModel from "../models/HouseOwners.js";

const router = express.Router();

/* ===========================
   SUBMIT OR UPDATE KYC
=========================== */
router.post("/submit", async (req, res) => {
    try {
        const {
            companyName,
            companyEmail,
            phone,
            location,
            idSnapshot,
            taxCardSnapshot,
            selfieWithId,
            email,
        } = req.body;

        if (!email) return res.status(400).json({ message: "Email is required" });

        // Check if KYC already exists
        let kyc = await HouseOwnerModel.findOne({ email });

        if (!kyc) {
            // If no existing KYC, create a new one
            kyc = await HouseOwnerModel.create({
                email,
                companyName,
                companyEmail,
                phone,
                location,
                idSnapshot,
                taxCardSnapshot,
                selfieWithId,
                status: "pending",
            });
        } else {
            // If exists, update existing KYC
            kyc = await HouseOwnerModel.findByIdAndUpdate(
                kyc._id,
                {
                    companyName,
                    companyEmail,
                    phone,
                    location,
                    idSnapshot,
                    taxCardSnapshot,
                    selfieWithId,
                    status: "pending",
                },
                { new: true }
            );
        }

        res.json({ message: "KYC submitted successfully", kyc });
    } catch (err) {
        console.error("Submit KYC Error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

/* ===========================
   UPDATE ACCOUNT STATUS
=========================== */
router.put("/status/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["pending", "approved", "rejected"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const kyc = await HouseOwnerModel.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!kyc) return res.status(404).json({ message: "KYC not found" });

        res.json({ message: "KYC status updated successfully", kyc });
    } catch (err) {
        console.error("Update Status Error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

router.get("/", async (req, res) => {
    try {
        const kycs = await HouseOwnerModel.find();
        if (kycs.length === 0) return res.status(404).json({ message: "No KYC records found" })
        res.status(200).json({ kycs })
    } catch (error) {
        res.status(500).json({ message: "Server error" })
        console.log("Get All KYC Error:", error)
    }
})

/* ===========================
   GET KYC BY EMAIL
=========================== */
router.get("/user/:email", async (req, res) => {
    try {
        const { email } = req.params;
        const kyc = await HouseOwnerModel.findOne({ email });

        if (!kyc) return res.status(404).json({ message: "KYC not found" });

        res.json({ kyc });
    } catch (err) {
        console.error("Get KYC Error:", err);
        res.status(500).json({ message: "Server error" });
    }
});

export default router;
