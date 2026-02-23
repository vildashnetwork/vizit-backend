

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import UserModel from "../models/Users.js";
import HouseOwnerModel from "../models/HouseOwners.js";

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
                const role = req.query.state; // "owner" or "seeker"

                if (!email) return done(null, false, { message: "No email found" });
                if (!role) return done(null, false, { message: "No role specified" });

                // 1. Cross-Check: Look for the email in BOTH collections
                const existingOwner = await HouseOwnerModel.findOne({ email });
                const existingSeeker = await UserModel.findOne({ email });

                // 2. Logic: If they exist in the OTHER role, block them
                if (role === "owner" && existingSeeker) {
                    console.error(`Conflict: ${email} is already registered as a Seeker.`);
                    return done(null, false, { message: "Email already used as a Seeker" });
                }

                if (role === "seeker" && existingOwner) {
                    console.error(`Conflict: ${email} is already registered as an Owner.`);
                    return done(null, false, { message: "Email already used as an Owner" });
                }

                // 3. Proceed with Login or Registration in the chosen role
                let user;
                if (role === "owner") {
                    user = existingOwner || await HouseOwnerModel.create({
                        googleId: profile.id,
                        email,
                        name: profile.displayName,
                        profile: profile.photos?.[0]?.value,
                        role: "owner",
                    });
                } else {
                    user = existingSeeker || await UserModel.create({
                        googleId: profile.id,
                        email,
                        name: profile.displayName,
                        profile: profile.photos?.[0]?.value,
                        role: "seeker",
                    });
                }

                // Sync googleId if missing
                if (!user.googleId) {
                    user.googleId = profile.id;
                    await user.save();
                }

                return done(null, user);
            } catch (err) {
                console.error("Google Strategy Error:", err);
                return done(err, null);
            }
        }
    )
);

// Keep Serializers as they were in the previous step...
passport.serializeUser((user, done) => {
    done(null, { id: user._id || user.id, role: user.role });
});

passport.deserializeUser(async (data, done) => {
    try {
        const Model = data.role === "owner" ? HouseOwnerModel : UserModel;
        const user = await Model.findById(data.id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});