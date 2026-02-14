


import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import env from "dotenv";
import { app, httpServer } from "./socket.js";

// Route Imports
import ownerroute from "./routes/OwnersLogin.js";
import userroute from "./routes/Users.js";
import house from "./routes/house.js";
import reels from './routes/Reels.js';
import like from "./routes/likecomment.js";
import messaging from "./routes/message.route.js";
import allcalls from "./routes/calling.js";
import apointment from "./routes/apoitment.js";
import video from "./routes/video.js";
import payment from "./routes/payment.js"
env.config();



// --- 1. MANUAL CORS OVERRIDE (USE THIS INSTEAD OF THE CORS PACKAGE) ---
// app.use((req, res, next) => {
//     const allowedOrigins = [
//         "http://localhost:5173",
//         "http://localhost:5174",
//         "https://vizit-seven.vercel.app"
//     ];
//     const origin = req.headers.origin;

//     if (allowedOrigins.includes(origin)) {
//         // This explicitly sets the origin instead of '*'
//         res.setHeader('Access-Control-Allow-Origin', origin);
//     }

//     res.setHeader('Access-Control-Allow-Credentials', 'true');
//     res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//     res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

//     // Handle the Preflight (OPTIONS) request immediately
//     if (req.method === 'OPTIONS') {
//         return res.status(200).json({});
//     }

//     next();
// });

// --- 2. SECURITY & OTHER MIDDLEWARE ---
app.use(
    helmet({
        // This setting is essential to allow cross-origin requests
        crossOriginResourcePolicy: { policy: "cross-origin" },
    })
);
app.use(morgan(":method :url :status :response-time ms - :res[content-length]"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- 3. ROUTES ---
app.use("/api/owner", ownerroute);
app.use("/api/user", userroute);
app.use("/api/house", house);
app.use("/api/reels", reels);
app.use("/api/like", like);
app.use("/api/messages", messaging);
app.use("/api/call", allcalls);
app.use("/api/apointment", apointment);
app.use("/api/video", video);
app.use("/api", payment);

app.get("/", (_req, res) => {
    res.send("server is on");
});

// --- 4. DATABASE CONNECTION ---
const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("database connected successfully!!");
    } catch (err) {
        console.error("error connecting to the database:", err);
    }
};

// --- 5. START SERVER ---
const PORT = process.env.PORT || 6300;

connectDb().then(() => {
    httpServer.listen(PORT, () => {
        console.log(`server running on port ${PORT}`);
    });
});

// TEMPORARY: Add this to server.js after 'database connected successfully'
mongoose.connection.once('open', async () => {
  try {
    const collection = mongoose.connection.db.collection('users');
    await collection.dropIndex('paymentprscribtion.nkwaTransactionId_1');
    console.log("✅ Old duplicate index dropped successfully!");
  } catch (err) {
    console.log("Note: Index not found or already dropped.");
  }
});


mongoose.connection.once('open', async () => {
  try {
    await mongoose.connection.db
      .collection('houseowners')
      .dropIndex('paymentprscribtion.nkwaTransactionId_1');

    console.log("✅ Index dropped successfully!");
  } catch (err) {
    console.log("Index not found or already removed.");
  }
});
