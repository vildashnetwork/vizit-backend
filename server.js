







// server.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { app, httpServer } from "./socket.js"; // expects socket.js to export `app` and `httpServer`
import session from "express-session";
import passport from "passport";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import MongoStore from "connect-mongo";
// Route Imports
import ownerroute from "./routes/OwnersLogin.js";
import userroute from "./routes/Users.js";
import house from "./routes/house.js";
import reels from "./routes/Reels.js";
import like from "./routes/likecomment.js";
import messaging from "./routes/message.route.js";
import allcalls from "./routes/calling.js";
import apointment from "./routes/apoitment.js"; // kept your original filename
import video from "./routes/video.js";
import payment from "./routes/payment.js";
import resetpass from "./routes/resetpass.js";
import kyc from "./routes/kyc.js"
import superRoute from "./routes/super.js";
import seperRoute from "./routes/supperreset.js"
import referal from "./routes/referal.js"

import "./auth/passport.js";

dotenv.config();

// -------------------- CONFIG --------------------

const isProd = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 6300;
const COOKIE_NAME = "token";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-jwt";
const FRONTEND = "https://www.vizit.homes";





app.use(cors({
  origin: [
    "https://www.vizit.homes",
    "https://dashboard.vizit.homes",
    "https://vizithomes.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
    "https://vizit-seven.vercel.app",
    "https://wicichats.vercel.app",
    "https://vizit-homes-k2n7.onrender.com",
    "http://169.254.237.117:8080",
    "http://localhost:8080",
    "http://192.168.43.221:8080",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Security + logging + parsers
app.use(
  helmet({
    // Allow cross-origin resource sharing where necessary
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(morgan(":method :url :status :response-time ms - :res[content-length]"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Trust proxy for platforms like Render/Heroku (needed for secure cookies behind proxies)
if (isProd) app.set("trust proxy", 1);

// Session
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "lax" : "none",
      maxAge: COOKIE_MAX_AGE,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

// -------------------- ROUTES --------------------

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
app.use("/api/resetpass", resetpass);
app.use("/api/kyc", kyc); // added KYC route
app.use("/super", superRoute);
app.use("/superreset", seperRoute);
app.use("/api/referal", referal);

app.get("/", (_req, res) => {
  res.send("server is on");
});

// -------------------- AUTH (Google OAuth) --------------------

// Start OAuth flow
// Start OAuth flow with role param
// app.get("/auth/google", (req, res, next) => {
//   const role = req.query.role;

//   if (!role || !["owner", "seeker"].includes(role)) {
//     return res.status(400).json({ message: "Invalid role parameter" });
//   }

//   passport.authenticate("google", {
//     scope: ["profile", "email"],
//     state: role,
//   })(req, res, next);
// });


// // OAuth callback
// app.get(
//   "/auth/google/callback",
//   passport.authenticate("google", {
//     failureRedirect: `${FRONTEND}/login-failed`,
//   }),
//   (req, res) => {
//     try {
//       if (!req.user) return res.redirect(`${FRONTEND}/login-failed`);

//       const token = jwt.sign(
//         {
//           id: req.user._id,
//           email: req.user.email,
//           role: req.user.role,
//         },
//         JWT_SECRET,
//         { expiresIn: "7d" }
//       );

//       res.cookie(COOKIE_NAME, token, {
//         httpOnly: true,
//         secure: isProd,
//         sameSite: isProd ? "lax" : "none",
//         maxAge: COOKIE_MAX_AGE,
//       });

//       const targetUrl = `${FRONTEND}/auth?token=${encodeURIComponent(
//         token
//       )}&role=${req.user.role}`;

//       return res.redirect(targetUrl);
//     } catch (err) {
//       console.error("Callback Error:", err);
//       return res.redirect(`${FRONTEND}/login-failed`);
//     }
//   }
// );

// Start OAuth flow
app.get("/auth/google", (req, res, next) => {
  const role = req.query.role;
  if (!role || !["owner", "seeker"].includes(role)) {
    return res.status(400).json({ message: "Invalid role parameter" });
  }

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: role, // pass role in state
  })(req, res, next);
});


const sendBrevoEmail = async (email) => {
  const apiKey = process.env.BREVO_API_KEY;
  const url = "https://api.brevo.com/v3/smtp/email";

  const emailContent = {
    sender: { name: "Vizit Support", email: process.env.SUPPORT_EMAIL },
    to: [{ email: email }],
    subject: "Your Vizit Login Notification",
    htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-top: 5px solid #244531; background: #d8d8d8;">
                
              <div style="background: url(https://res.cloudinary.com/dgigs6v72/image/upload/v1771837346/gd6kglmmwyn3n8bupxim.jpg) ; padding: 20px; width:100%; height:150px; text-align: center;">
                 
                </div>
            <div style="background-color: #f9f9f9; padding: 20px; text-align: center;">
                    <h1 style="color: #244531; margin: 0;">Vizit</h1>
                </div>
                <div style="padding: 30px; color: #333;">
                    <h2>Your Currently Logged in from</h2>
                    <p>You Logged Into Your Account succesfully at ${new Date.toLocaleString()}</p>
                    <div style="background: #f0fdf4; border: 1px dashed #22c55e; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #244531; letter-spacing: 5px;">
                    
                    </div>
                    <p style="margin-top: 20px;">this email is to tell when you try accessing your account.</p>
                </div>
                <div style="background: #244531; color: white; padding: 15px; text-align: center; font-size: 12px;">
                    © ${new Date.toLocaleString()} Vizit Support. All rights reserved.
                </div>
            </div>
        `
  };

  await axios.post(url, emailContent, {
    headers: { "api-key": apiKey, "Content-Type": "application/json" }
  });
};


// Callback
app.get(
  "/auth/google/callback",
  (req, res, next) => {
    passport.authenticate("google", async (err, user) => {
      try {
        if (err) {
          console.error("Google callback error:", err);
          return res.redirect(`${FRONTEND}/login-failed`);
        }
        if (!user) {
          console.error("No user returned from Google strategy");
          return res.redirect(`${FRONTEND}/login-failed`);
        }
        sendBrevoEmail(user?.email); // send login notification email
        // Create JWT
        const token = jwt.sign(
          { id: user._id, email: user.email, role: user.role },
          JWT_SECRET,
          { expiresIn: "7d" }
        );

        res.cookie(COOKIE_NAME, token, {
          httpOnly: true,
          secure: isProd,
          sameSite: isProd ? "lax" : "none",
          maxAge: COOKIE_MAX_AGE,
        });

        // Redirect with token
        const targetUrl = `${FRONTEND}/auth?token=${encodeURIComponent(token)}&role=${user.role}`;

        return res.redirect(targetUrl);


      } catch (err) {
        console.error("Callback processing error:", err);
        return res.redirect(`${FRONTEND}/login-failed`);
      }
    })(req, res, next);
  }
);

// Logout
app.get("/auth/logout", (req, res, next) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "lax" : "none",
  });

  // Passport >=0.6 requires callback for logout
  req.logout((err) => {
    if (err) return next(err);
    return res.redirect(FRONTEND);
  });
});

// -------------------- DATABASE CONNECT --------------------

const connectDb = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set in environment");
    throw new Error("MONGODB_URI not provided");
  }

  try {
    await mongoose.connect(uri, { autoIndex: true });
    console.log("database connected successfully!!");
  } catch (err) {
    console.error("error connecting to the database:", err);
    throw err;
  }
};

// On DB open, attempt to drop legacy/duplicate indexes (safe wrapped)
mongoose.connection.once("open", async () => {
  // attempt to drop index from users collection
  try {
    const usersCollection = mongoose.connection.db.collection("users");
    // only attempt if index exists - dropIndex will throw if missing; keep try/catch
    await usersCollection.dropIndex("paymentprscribtion.nkwaTransactionId_1");
    console.log("✅ Old duplicate index dropped successfully from 'users' collection!");
  } catch (err) {
    console.log("Note: users index not found or already dropped.", err?.message || "");
  }

  // attempt to drop index from houseowners collection
  try {
    const houseOwnersCollection = mongoose.connection.db.collection("houseowners");
    await houseOwnersCollection.dropIndex("paymentprscribtion.nkwaTransactionId_1");
    console.log("✅ Index dropped successfully from 'houseowners' collection!");
  } catch (err) {
    console.log("Note: houseowners index not found or already removed.", err?.message || "");
  }
});

// -------------------- START SERVER --------------------

connectDb()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server due to DB connection error:", err);
    process.exit(1);
  });

// export app/httpServer only if you intended to; this file expects socket.js to already export them.
// End of file
