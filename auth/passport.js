















import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import UserModel from "../models/Users.js";
import HouseOwnerModel from "../models/HouseOwners.js";

/* ==============================
   GOOGLE STRATEGY
============================== */






passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
            passReqToCallback: true,
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;
                const role = req.query.state; // expected "owner" or "seeker"

                console.log("Google callback profile:", profile);
                console.log("Google callback role (state):", role);

                if (!email) {
                    return done(new Error("Google account has no email"), null);
                }

                if (!["owner", "seeker"].includes(role)) {
                    return done(new Error("Invalid role selected"), null);
                }

                let existingUser;

                // -----------------------------
                // OWNER LOGIN
                a                // -----------------------------
                if (role === "owner") {
                    existingUser = await HouseOwnerModel.findOne({ email });
                    if (!existingUser) {
                        existingUser = await HouseOwnerModel.create({
                            googleId: profile.id,
                            email,
                            name: profile.displayName,
                            profile: profile.photos?.[0]?.value,
                            role: "owner",
                        });
                    }
                }

                // -----------------------------
                // SEEKER LOGIN
                // -----------------------------
                if (role === "seeker") {
                    existingUser = await UserModel.findOne({ email });
                    if (!existingUser) {
                        existingUser = await UserModel.create({
                            googleId: profile.id,
                            email,
                            name: profile.displayName,
                            profile: profile.photos?.[0]?.value,
                            role: "seeker",
                        });
                    }
                }

                // -----------------------------
                // Ensure googleId is saved
                // -----------------------------
                if (!existingUser.googleId) {
                    existingUser.googleId = profile.id;
                    await existingUser.save();
                }

                // return sanitized user info
                return done(null, {
                    id: existingUser._id.toString(),
                    role: existingUser.role,
                    email: existingUser.email,
                });
            } catch (err) {
                console.error("GoogleStrategy Error:", err);
                return done(err, null);
            }
        }
    )
);

/* ==============================
   SERIALIZE USER
============================== */
passport.serializeUser((user, done) => {
    done(null, { id: user.id, role: user.role });
});

/* ==============================
   DESERIALIZE USER
============================== */
passport.deserializeUser(async (data, done) => {
    try {
        if (!data?.id || !data?.role) return done(new Error("Invalid session"), null);

        const Model = data.role === "owner" ? HouseOwnerModel : UserModel;
        const user = await Model.findById(data.id);

        if (!user) {
            return done(new Error("User not found"), null);
        }

        done(null, user);
    } catch (err) {
        console.error("DeserializeUser Error:", err);
        done(err, null);
    }
});
