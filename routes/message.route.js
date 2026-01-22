// import express from "express";
// import { getMessages, getUsersForSidebar, sendMessage } from './controllers/message.controller.js';

// const router = express.Router();

// // all routes now require login
// router.get("/users/:loggedInUserId", getUsersForSidebar);
// router.get("/:id", getMessages);
// router.post("/send/:id", sendMessage);

// export default router;



import express from "express";
import {
    getMessages,
    getUsersForSidebar,
    sendMessage
} from "./controllers/message.controller.js";
import { initiateCall, acceptCall, endCall } from "./controllers/videoCall.controller.js";
import { markMessagesAsRead } from "../controllers/message.controller.js";
const router = express.Router();

router.get("/users/:loggedInUserId", getUsersForSidebar);
router.get("/:id", getMessages);
router.post("/send/:id", sendMessage);

router.put(
    "/read/:chatUserId",
    markMessagesAsRead
);


// POST /api/call/initiate
router.post("/initiate", initiateCall);

// POST /api/call/accept
router.post("/accept", acceptCall);

// POST /api/call/end
router.post("/end", endCall);

export default router;
