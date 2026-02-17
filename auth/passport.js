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
                const roleFromState = req.query.state; // 👈 GET ROLE HERE

                if (!["owner", "seeker"].includes(roleFromState)) {
                    return done(new Error("Invalid role received"), null);
                }

                let existingUser;

                if (roleFromState === "owner") {
                    existingUser = await HouseOwnerModel.findOne({ email });
                    const meexistingUser = await UserModel.findOne({ email });
                    if (!existingUser && !meexistingUser) {
                        existingUser = await HouseOwnerModel.create({
                            googleId: profile.id,
                            email,
                            name: profile.displayName,
                            profile: profile.photos?.[0]?.value,
                            role: "owner",
                        });
                    }
                } else {
                    existingUser = await UserModel.findOne({ email });
                    const meexistingUser = await HouseOwnerModel.findOne({ email });

                    if (!existingUser && !meexistingUser) {
                        existingUser = await UserModel.create({
                            googleId: profile.id,
                            email,
                            name: profile.displayName,
                            profile: profile.photos?.[0]?.value,
                            role: "seeker",
                        });
                    }
                }

                // If account exists but no googleId
                if (!existingUser.googleId) {
                    existingUser.googleId = profile.id;
                    await existingUser.save();
                }

                const userObj = existingUser.toObject();
                userObj.role = roleFromState;

                return done(null, userObj);
            } catch (err) {
                return done(err, null);
            }
        }
    )
);

// Serialize
passport.serializeUser((user, done) => {
    done(null, { id: user._id, role: user.role });
});

// Deserialize
passport.deserializeUser(async (data, done) => {
    try {
        const Model =
            data.role === "owner" ? HouseOwnerModel : UserModel;

        const user = await Model.findById(data.id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});
