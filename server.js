import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import env from "dotenv";
// import cron from "node-cron";
// import fetch from "node-fetch";
import ownerroute from "./routes/OwnersLogin.js";
import userroute from "./routes/Users.js";
import house from "./routes/house.js";
import { app, httpServer } from "./socket.js";
import reels from './routes/Reels.js'
import like from "./routes/likecomment.js"
import messaging from "./routes/message.route.js";
import allcalls from "./routes/calling.js"


env.config();


// 1. Initialize app (already done via socket.js import likely)

// 2. CORS MUST BE FIRST
const allowedOrigins = [
    "http://localhost:5173",
    "https://vizit-seven.vercel.app",
    "http://localhost:5174",
];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
        optionsSuccessStatus: 200
    })
);

// Specifically handle preflight requests for all routes
app.options("*", cors());
// Middleware
app.use(helmet());
app.use(morgan(":method :url :status :response-time ms - :res[content-length]"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
// const allowedOrigins = [
//     "http://localhost:5173",
//     "https://vizit-seven.vercel.app",
//     "http://localhost:5174",
// ];

// app.use(
//     cors({
//         origin: function (origin, callback) {
//             // Allow requests with no origin (like mobile apps or curl)
//             if (!origin) return callback(null, true);

//             if (allowedOrigins.indexOf(origin) !== -1) {
//                 callback(null, true);
//             } else {
//                 callback(new Error("Not allowed by CORS"));
//             }
//         },
//         methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//         credentials: true,
//         optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
//     })
// );

// Routes
app.use("/api/owner", ownerroute);
app.use("/api/user", userroute);
app.use("/api/house", house);
app.use("/api/reels", reels)
app.use("/api/like", like)
app.use("/api/messages", messaging);
app.use("/api/call", allcalls);

app.get("/", (_req, res) => {
    res.send("server is on");
});

// Keep server alive
// const URL = "http://localhost:6300/ping";
// function scheduleRandomPing() {
//     const minutes = Math.floor(Math.random() * 11) + 5;
//     cron.schedule(`*/${minutes} * * * *`, async () => {
//         try {
//             await fetch(URL);
//             console.log("pinged");
//         } catch (e) {
//             console.error("ping failed", e.message);
//         }
//     });
// }
// scheduleRandomPing();

// Database connection
const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("database connected successfully!!");
    } catch (err) {
        console.error("error connecting to the database:", err);
    }
};

// Start server
const PORT = process.env.PORT || 6300;

connectDb().then(() => {
    httpServer.listen(PORT, () => {
        console.log(`server running on http://127.0.0.1:${PORT}`);
    });
});
