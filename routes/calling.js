import express from "express";

import { initiateCall, acceptCall, endCall } from "./controllers/videoCall.controller.js";

const router = express.Router();
// POST /api/call/initiate
router.post("/initiate", initiateCall);

// POST /api/call/accept
router.post("/accept", acceptCall);

// POST /api/call/end
router.post("/end", endCall);

export default router;
