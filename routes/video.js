import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/turn-create", async (req, res) => {
    try {
        const secretKey = process.env.METERED_SECRET_KEY;

        if (!secretKey) {
            return res.status(500).json({ error: "Missing Metered secret key" });
        }

        const url = `https://vizit.metered.live/api/v1/turn/credential?secretKey=${secretKey}`;

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                expiryInSeconds: 3600
            })
        });

        const data = await response.json();
        return res.json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to get TURN credentials" });
    }
});

export default router;