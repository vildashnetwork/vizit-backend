


// import express from "express";
// import cors from "cors";
// import helmet from "helmet";
// import morgan from "morgan";
// import mongoose from "mongoose";
// import env from "dotenv";
// import { app, httpServer } from "./socket.js";
// import session from "express-session";
// import passport from "passport";

// import cookieParser from "cookie-parser";
// import jwt from "jsonwebtoken";
// // Route Imports
// import ownerroute from "./routes/OwnersLogin.js";
// import userroute from "./routes/Users.js";
// import house from "./routes/house.js";
// import reels from './routes/Reels.js';
// import like from "./routes/likecomment.js";
// import messaging from "./routes/message.route.js";
// import allcalls from "./routes/calling.js";
// import apointment from "./routes/apoitment.js";
// import video from "./routes/video.js";
// import payment from "./routes/payment.js"
// import resetpass from "./routes/resetpass.js";
// import "./auth/passport.js";
// env.config();



// // --- 1. MANUAL CORS OVERRIDE (USE THIS INSTEAD OF THE CORS PACKAGE) ---
// // app.use((req, res, next) => {
// //     const allowedOrigins = [
// //         "http://localhost:5173",
// //         "http://localhost:5174",
// //         "https://vizit-seven.vercel.app"
// //     ];
// //     const origin = req.headers.origin;

// //     if (allowedOrigins.includes(origin)) {
// //         // This explicitly sets the origin instead of '*'
// //         res.setHeader('Access-Control-Allow-Origin', origin);
// //     }

// //     res.setHeader('Access-Control-Allow-Credentials', 'true');
// //     res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
// //     res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

// //     // Handle the Preflight (OPTIONS) request immediately
// //     if (req.method === 'OPTIONS') {
// //         return res.status(200).json({});
// //     }

// //     next();
// // });

// // --- 2. SECURITY & OTHER MIDDLEWARE ---
// app.use(
//   helmet({
//     // This setting is essential to allow cross-origin requests
//     crossOriginResourcePolicy: { policy: "cross-origin" },
//   })
// );
// app.use(morgan(":method :url :status :response-time ms - :res[content-length]"));
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
// const isProd = process.env.NODE_ENV === "production";

// // trust proxy for Render/Heroku
// if (isProd) app.set("trust proxy", 1);

// app.use(
//   session({
//     secret: process.env.SESSION_SECRET || "change-me",
//     resave: false,
//     saveUninitialized: false,
//     cookie: {
//       httpOnly: true,
//       secure: isProd,
//       sameSite: isProd ? "lax" : "none",
//     },
//   })
// );
// app.use(passport.initialize());
// app.use(passport.session());
// // --- 3. ROUTES ---
// app.use("/api/owner", ownerroute);
// app.use("/api/user", userroute);
// app.use("/api/house", house);
// app.use("/api/reels", reels);
// app.use("/api/like", like);
// app.use("/api/messages", messaging);
// app.use("/api/call", allcalls);
// app.use("/api/apointment", apointment);
// app.use("/api/video", video);
// app.use("/api", payment);
// app.use("/api/resetpass", resetpass);

// app.get("/", (_req, res) => {
//   res.send("server is on");
// });


// const COOKIE_NAME = "token";
// const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// // ===================================================
// // ✅ GOOGLE OAUTH (WEB + DESKTOP)
// // ===================================================

// const FRONTEND = "https://www.vizit.homes";

// // web OAuth start
// app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// app.get(
//   "/auth/google/callback",
//   passport.authenticate("google", { failureRedirect: `${FRONTEND}/login-failed` }),
//   (req, res) => {
//     try {
//       if (!req.user) return res.redirect(`${FRONTEND}/login-failed`);

//       // 1. Sign JWT including the Role
//       const token = jwt.sign(
//         { id: req.user._id, email: req.user.email, role: req.user.role },
//         process.env.JWT_SECRET,
//         { expiresIn: "7d" }
//       );

//       // 2. Set Cookie (for Web)
//       res.cookie("token", token, {
//         httpOnly: true,
//         secure: true,
//         sameSite: "none",
//         maxAge: 7 * 24 * 60 * 60 * 1000,
//       });

//       // 3. Redirect with Params
//       // Frontend can now read: const urlParams = new URLSearchParams(window.location.search);
//       // const role = urlParams.get('role');
//       const targetUrl = `${FRONTEND}/auth?token=${encodeURIComponent(token)}&role=${req.user.role}`;

//       return res.redirect(targetUrl);
//     } catch (err) {
//       console.error("Callback Error:", err);
//       return res.redirect(`${FRONTEND}/login-failed`);
//     }
//   }
// );

// // logout
// app.get("/auth/logout", (req, res, next) => {
//   res.clearCookie(COOKIE_NAME, {
//     httpOnly: true,
//     secure: isProd,
//     sameSite: isProd ? "lax" : "none",
//   });
//   req.logout(err => {
//     if (err) return next(err);
//     return res.redirect(FRONTEND_URL);
//   });
// });





// // --- 4. DATABASE CONNECTION ---
// const connectDb = async () => {
//   try {
//     await mongoose.connect(process.env.MONGODB_URI);
//     console.log("database connected successfully!!");
//   } catch (err) {
//     console.error("error connecting to the database:", err);
//   }
// };

// // --- 5. START SERVER ---
// const PORT = process.env.PORT || 6300;

// connectDb().then(() => {
//   httpServer.listen(PORT, () => {
//     console.log(`server running on port ${PORT}`);
//   });
// });

// // TEMPORARY: Add this to server.js after 'database connected successfully'
// mongoose.connection.once('open', async () => {
//   try {
//     const collection = mongoose.connection.db.collection('users');
//     await collection.dropIndex('paymentprscribtion.nkwaTransactionId_1');
//     console.log("✅ Old duplicate index dropped successfully!");
//   } catch (err) {
//     console.log("Note: Index not found or already dropped.");
//   }
// });


// mongoose.connection.once('open', async () => {
//   try {
//     await mongoose.connection.db
//       .collection('houseowners')
//       .dropIndex('paymentprscribtion.nkwaTransactionId_1');

//     console.log("✅ Index dropped successfully!");
//   } catch (err) {
//     console.log("Index not found or already removed.");
//   }
// });

















































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

import "./auth/passport.js";

dotenv.config();

// -------------------- CONFIG --------------------

const isProd = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 6300;
const COOKIE_NAME = "token";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_SECRET = process.env.SESSION_SECRET || "change-me";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-jwt";
const FRONTEND = process.env.FRONTEND_URL || "https://www.vizit.homes";
// const ALLOWED_ORIGINS = [
//   "http://localhost:5173",
//   "http://localhost:5174",
//   "https://vizit-seven.vercel.app",
//   FRONTEND,
// ];

// -------------------- MIDDLEWARE --------------------

// CORS
// app.use(
//   cors({
//     origin: (origin, callback) => {
//       // allow requests with no origin (like mobile apps, curl, postman)
//       if (!origin) return callback(null, true);
//       if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
//       return callback(new Error("CORS policy: origin not allowed"), false);
//     },
//     credentials: true,
//   })
// );

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

app.get("/", (_req, res) => {
  res.send("server is on");
});

// -------------------- AUTH (Google OAuth) --------------------

// Start OAuth flow
// Start OAuth flow with role param
app.get("/auth/google", (req, res, next) => {
  const role = req.query.role;

  if (!role || !["owner", "seeker"].includes(role)) {
    return res.status(400).json({ message: "Invalid role parameter" });
  }

  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: role, // pass role via OAuth state
  })(req, res, next);
});


// OAuth callback
app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${FRONTEND}/login-failed`,
  }),
  (req, res) => {
    try {
      if (!req.user) return res.redirect(`${FRONTEND}/login-failed`);

      const token = jwt.sign(
        {
          id: req.user._id,
          email: req.user.email,
          role: req.user.role,
        },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "lax" : "none",
        maxAge: COOKIE_MAX_AGE,
      });

      const targetUrl = `${FRONTEND}/auth?token=${encodeURIComponent(
        token
      )}&role=${req.user.role}`;

      return res.redirect(targetUrl);
    } catch (err) {
      console.error("Callback Error:", err);
      return res.redirect(`${FRONTEND}/login-failed`);
    }
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
