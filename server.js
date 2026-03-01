




import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { app, httpServer } from "./socket.js";
import session from "express-session";
import passport from "passport";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import MongoStore from "connect-mongo";
import axios from "axios"
// Route Imports
import ownerroute from "./routes/OwnersLogin.js";
import userroute from "./routes/Users.js";
import house from "./routes/house.js";
import reels from "./routes/Reels.js";
import like from "./routes/likecomment.js";
import messaging from "./routes/message.route.js";
import allcalls from "./routes/calling.js";
import apointment from "./routes/apoitment.js";
import video from "./routes/video.js";
import payment from "./routes/payment.js";
import resetpass from "./routes/resetpass.js";
import kyc from "./routes/kyc.js";
import superRoute from "./routes/super.js";
import seperRoute from "./routes/supperreset.js";
import referal from "./routes/referal.js";

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

// -------------------- MIDDLEWARE --------------------

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

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(morgan(":method :url :status :response-time ms - :res[content-length]"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (isProd) app.set("trust proxy", 1);

// Session Management
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
app.use("/api/kyc", kyc);
app.use("/super", superRoute);
app.use("/superreset", seperRoute);
app.use("/api/referal", referal);

app.get("/", (_req, res) => {
  res.send("Vizit Server is active");
});

// -------------------- AUTH (Google OAuth) --------------------

app.get("/auth/google", (req, res, next) => {
  const role = req.query.role;
  if (!role || !["owner", "seeker"].includes(role)) {
    return res.status(400).json({ message: "Invalid role parameter" });
  }

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: role,
  })(req, res, next);
});



const sendBrevoEmail = async (email) => {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    const url = "https://api.brevo.com/v3/smtp/email";
    const currentYear = new Date().getFullYear();
    const timestamp = new Date().toLocaleString();

    const emailContent = {
      sender: { name: "Vizit Support", email: process.env.SUPPORT_EMAIL },
      to: [{ email: email }],
      subject: "Your Vizit Login Notification",
      htmlContent: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; border-top: 5px solid #244531; background: #f4f4f4;">
                    <div style="background: url('https://res.cloudinary.com/dgigs6v72/image/upload/v1771837346/gd6kglmmwyn3n8bupxim.jpg'); background-size: cover; padding: 20px; width:100%; height:150px; text-align: center;">
                    </div>
                    <div style="background-color: #ffffff; padding: 20px; text-align: center;">
                        <h1 style="color: #244531; margin: 0;">Vizit</h1>
                    </div>
                    <div style="padding: 30px; color: #333; background-color: #ffffff;">
                        <h2 style="color: #244531;">Security Notification</h2>
                        <p>You successfully logged into your account at: <strong>${timestamp}</strong></p>
                        <p style="margin-top: 20px; font-size: 14px; color: #666;">
                            If this wasn't you, please reset your password immediately to secure your account.
                        </p>
                    </div>
                    <div style="background: #244531; color: white; padding: 15px; text-align: center; font-size: 12px;">
                        © ${currentYear} Vizit Support. All rights reserved.
                    </div>
                </div>
            `
    };

    await axios.post(url, emailContent, {
      headers: { "api-key": apiKey, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Email failed to send:", error.response?.data || error.message);
  }
};




// 1. Updated Initial Request Route
app.get("/auth/google", (req, res, next) => {
  const role = req.query.role;
  // Capture mobile redirect if present, otherwise null
  const mobileRedirect = req.query.mobile_redirect || null;

  if (!role || !["owner", "seeker"].includes(role)) {
    return res.status(400).json({ message: "Invalid role parameter" });
  }

  // We pack both role and mobileRedirect into the state
  const stateData = JSON.stringify({ role, mobileRedirect });

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: stateData, // Google will send this back to our callback
  })(req, res, next);
});

app.post("/api/auth/google-mobile", async (req, res) => {
  try {
    const { token, role } = req.body;

    if (!token || !role) {
      return res.status(400).json({ message: "Token and role are required" });
    }

    // 1. Verify the token with Google
    const googleResponse = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`);
    const { email, sub: googleId } = googleResponse.data;

    // 2. Find the user based on the role provided by the app
    // Using your existing model logic
    let user;
    if (role === "owner") {
      user = await mongoose.connection.db.collection("houseowners").findOne({ email });
    } else {
      user = await mongoose.connection.db.collection("users").findOne({ email });
    }

    if (!user) {
      return res.status(404).json({ message: "Account not found. Please register on the web first." });
    }

    // 3. Issue Vizit JWT
    const vizitToken = jwt.sign(
      { id: user._id, email: user.email, role: role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 4. Send security email (Optional but recommended for consistency)
    sendBrevoEmail(user.email);

    res.json({ 
      token: vizitToken,
      role: role,
      user: { email: user.email, name: user.name } 
    });

  } catch (error) {
    console.error("Mobile Auth Error:", error.response?.data || error.message);
    res.status(500).json({ message: "Authentication failed" });
  }
});
// 2. Updated Callback Route
app.get("/auth/google/callback", (req, res, next) => {
  passport.authenticate("google", (err, user, info) => {
    if (err || !user) {
      return res.redirect(`${FRONTEND}/login-failed`);
    }

    req.login(user, (loginErr) => {
      if (loginErr) return res.redirect(`${FRONTEND}/login-failed`);

      try {
        // --- DATA EXTRACTION ---
        let mobileRedirect = null;
        if (req.query.state) {
          try {
            const parsedState = JSON.parse(req.query.state);
            mobileRedirect = parsedState.mobileRedirect;
          } catch (e) {
            console.error("State parsing failed");
          }
        }

        const token = jwt.sign(
          { id: user.id || user._id, email: user.email, role: user.role },
          JWT_SECRET,
          { expiresIn: "7d" }
        );

        // --- WEB COOKIE (Keep this for Web users) ---
        res.cookie(COOKIE_NAME, token, {
          httpOnly: true,
          secure: isProd,
          sameSite: isProd ? "lax" : "none",
          maxAge: COOKIE_MAX_AGE,
        });

        sendBrevoEmail(user.email);

        // --- THE "SWITCH" LOGIC ---
        if (mobileRedirect) {
          // MOBILE FLOW: Redirect to the app scheme
          // e.g., vizitmobile://auth-callback?token=...
          const appUrl = `${mobileRedirect}?token=${encodeURIComponent(token)}&role=${user.role}`;
          return res.redirect(appUrl);
        } else {
          // WEB FLOW: Redirect to your standard web dashboard
          const webUrl = `${FRONTEND}/auth?token=${encodeURIComponent(token)}&role=${user.role}`;
          return res.redirect(webUrl);
        }

      } catch (jwtErr) {
        return res.redirect(`${FRONTEND}/login-failed`);
      }
    });
  })(req, res, next);
});



// app.get("/auth/google/callback", (req, res, next) => {
//   passport.authenticate("google", (err, user, info) => {
//     if (err) {
//       console.error("Passport Auth Error:", err);
//       return res.redirect(`${FRONTEND}/login-failed`);
//     }
//     if (!user) {
//       console.error("Auth Failed: No user found", info);
//       return res.redirect(`${FRONTEND}/login-failed`);
//     }

//     // Passport's req.login is required when using a custom callback with sessions
//     req.login(user, (loginErr) => {
//       if (loginErr) {
//         console.error("Login Error:", loginErr);
//         return res.redirect(`${FRONTEND}/login-failed`);
//       }

//       try {
//         // Create JWT - ensure you use user.id or user._id consistently
//         const token = jwt.sign(
//           {
//             id: user.id || user._id,
//             email: user.email,
//             role: user.role
//           },
//           JWT_SECRET,
//           { expiresIn: "7d" }
//         );

//         res.cookie(COOKIE_NAME, token, {
//           httpOnly: true,
//           secure: isProd,
//           sameSite: isProd ? "lax" : "none",
//           maxAge: COOKIE_MAX_AGE,
//         });
//         sendBrevoEmail(user.email); // Send login notification email
//         const targetUrl = `${FRONTEND}/auth?token=${encodeURIComponent(token)}&role=${user.role}`;
//         return res.redirect(targetUrl);
//       } catch (jwtErr) {
//         console.error("JWT Signing Error:", jwtErr);
//         return res.redirect(`${FRONTEND}/login-failed`);
//       }
//     });
//   })(req, res, next);
// });

app.get("/auth/logout", (req, res, next) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "lax" : "none",
  });

  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.redirect(FRONTEND);
    });
  });
});

// -------------------- DATABASE --------------------

const connectDb = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not provided");

  try {
    await mongoose.connect(uri, { autoIndex: true });
    console.log("Database connected successfully!!");
  } catch (err) {
    console.error("Database connection error:", err);
    throw err;
  }
};

mongoose.connection.once("open", async () => {
  const collections = ["users", "houseowners"];
  for (const name of collections) {
    try {
      await mongoose.connection.db.collection(name).dropIndex("paymentprscribtion.nkwaTransactionId_1");
      console.log(`✅ Index dropped: ${name}`);
    } catch (e) {
      // Index doesn't exist, which is fine
    }
  }
});

// -------------------- START --------------------

connectDb()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Critical Failure:", err);
    process.exit(1);
  });