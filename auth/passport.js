// import passport from "passport";
// import { Strategy as GoogleStrategy } from "passport-google-oauth20";
// import UserModel from "../models/Users.js";
// import HouseOwnerModel from "../models/HouseOwners.js";

// passport.use(
//     new GoogleStrategy(
//         {
//             clientID: process.env.GOOGLE_CLIENT_ID,
//             clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//             callbackURL: process.env.GOOGLE_CALLBACK_URL,
//             passReqToCallback: true,
//         },
//         async (req, accessToken, refreshToken, profile, done) => {
//             try {
//                 const email = profile.emails?.[0]?.value;
//                 const roleFromState = req.query.state; // 👈 GET ROLE HERE

//                 if (!["owner", "seeker"].includes(roleFromState)) {
//                     return done(new Error("Invalid role received"), null);
//                 }

//                 let existingUser;

//                 if (roleFromState === "owner") {
//                     existingUser = await HouseOwnerModel.findOne({ email });
//                     const meexistingUser = await UserModel.findOne({ email });
//                     if (!existingUser && !meexistingUser) {
//                         existingUser = await HouseOwnerModel.create({
//                             googleId: profile.id,
//                             email,
//                             name: profile.displayName,
//                             profile: profile.photos?.[0]?.value,
//                             role: "owner",
//                         });
//                     }
//                 } else {
//                     existingUser = await UserModel.findOne({ email });
//                     const meexistingUser = await HouseOwnerModel.findOne({ email });

//                     if (!existingUser && !meexistingUser) {
//                         existingUser = await UserModel.create({
//                             googleId: profile.id,
//                             email,
//                             name: profile.displayName,
//                             profile: profile.photos?.[0]?.value,
//                             role: "seeker",
//                         });
//                     }
//                 }

//                 // If account exists but no googleId
//                 if (!existingUser.googleId) {
//                     existingUser.googleId = profile.id;
//                     await existingUser.save();
//                 }

//                 const userObj = existingUser.toObject();
//                 userObj.role = roleFromState;

//                 return done(null, userObj);
//             } catch (err) {
//                 return done(err, null);
//             }
//         }
//     )
// );

// // Serialize
// passport.serializeUser((user, done) => {
//     done(null, { id: user._id, role: user.role });
// });

// // Deserialize
// passport.deserializeUser(async (data, done) => {
//     try {
//         const Model =
//             data.role === "owner" ? HouseOwnerModel : UserModel;

//         const user = await Model.findById(data.id);
//         done(null, user);
//     } catch (err) {
//         done(err, null);
//     }
// });





































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
                const roleFromState = req.query.state; // owner or seeker

                if (!email) {
                    return done(new Error("Google account has no email"), null);
                }

                if (!["owner", "seeker"].includes(roleFromState)) {
                    return done(new Error("Invalid role selected"), null);
                }

                // 🔎 Check both collections
                const ownerAccount = await HouseOwnerModel.findOne({ email });
                const seekerAccount = await UserModel.findOne({ email });

                /* =======================================================
                   🚫 PREVENT CROSS ROLE LOGIN
                ======================================================= */

                // If email already exists as owner but trying seeker login
                if (ownerAccount && roleFromState === "seeker") {
                    return done(
                        new Error(
                            "This email is already registered as Owner. Please login as Owner."
                        ),
                        null
                    );
                }

                // If email already exists as seeker but trying owner login
                if (seekerAccount && roleFromState === "owner") {
                    return done(
                        new Error(
                            "This email is already registered as Seeker. Please login as Seeker."
                        ),
                        null
                    );
                }

                let existingUser;

                /* =======================================================
                   OWNER LOGIN
                ======================================================= */
                if (roleFromState === "owner") {
                    if (ownerAccount) {
                        existingUser = ownerAccount;
                    } else {
                        existingUser = await HouseOwnerModel.create({
                            googleId: profile.id,
                            email,
                            name: profile.displayName,
                            profile: profile.photos?.[0]?.value,
                            role: "owner",
                        });
                    }
                }

                /* =======================================================
                   SEEKER LOGIN
                ======================================================= */
                if (roleFromState === "seeker") {
                    if (seekerAccount) {
                        existingUser = seekerAccount;
                    } else {
                        existingUser = await UserModel.create({
                            googleId: profile.id,
                            email,
                            name: profile.displayName,
                            profile: profile.photos?.[0]?.value,
                            role: "seeker",
                        });
                    }
                }

                /* =======================================================
                   Ensure googleId is saved
                ======================================================= */
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

/* =======================================================
   SERIALIZE
======================================================= */
passport.serializeUser((user, done) => {
    done(null, { id: user._id, role: user.role });
});

/* =======================================================
   DESERIALIZE
======================================================= */
passport.deserializeUser(async (data, done) => {
    try {
        const Model =
            data.role === "owner"
                ? HouseOwnerModel
                : UserModel;

        const user = await Model.findById(data.id);

        if (!user) {
            return done(new Error("User not found"), null);
        }

        done(null, user);
    } catch (err) {
        done(err, null);
    }
});
