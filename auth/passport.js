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
            passReqToCallback: true // Allows us to access the request (to get role if needed)
        },
        async (req, accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails?.[0]?.value;

                // 1. Search across BOTH collections
                let user = await UserModel.findOne({ email });
                let owner = await HouseOwnerModel.findOne({ email });

                let finalUser = user || owner;

                // 2. If user doesn't exist at all, REGISTER automatically
                if (!finalUser) {
                    // Default to 'user' role unless frontend specified otherwise in session
                    finalUser = await UserModel.create({
                        googleId: profile.id,
                        email: email,
                        name: profile.displayName,
                        profile: profile.photos?.[0]?.value,
                        role: "user"
                    });
                } else {
                    // 3. Link Google ID if it's an existing account without one
                    if (!finalUser.googleId) {
                        finalUser.googleId = profile.id;
                        await finalUser.save();
                    }
                }

                // Append the role to the object so the callback can see it
                const userObj = finalUser.toObject();
                userObj.role = user ? "user" : "owner";

                return done(null, userObj);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

passport.serializeUser((user, done) => done(null, { id: user._id, role: user.role }));
passport.deserializeUser(async (data, done) => {
    try {
        const Model = data.role === "owner" ? HouseOwnerModel : UserModel;
        const user = await Model.findById(data.id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});