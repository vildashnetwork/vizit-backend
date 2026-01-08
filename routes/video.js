// turn.js (or inside your existing server)
import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.get("/turn-credentials", async (req, res) => {
    try {
        const response = await fetch(
            "https://vizit.metered.live/api/v1/turn/credentials",
            {
                headers: {
                    "Authorization": `Bearer ${process.env.video}`,
                }
            }
        );

        const data = await response.json();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Failed to get TURN credentials" });
    }
});

export default router;
