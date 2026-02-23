import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import decodeTokenFromReq from "./decode.js";
import HouseOwerModel from "../models/HouseOwners.js";
import UserModel from "../models/Users.js";
dotenv.config();

const router = express.Router();
const SALT_ROUNDS = 10;





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


const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, email: user.email, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: "15d" }
    );
};


//regex to validate the email format 

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const sendWelcomeEmail = async (userEmail, userName) => {
    try {
        const apiKey = process.env.BREVO_API_KEY;
        const url = "https://api.brevo.com/v3/smtp/email";
        const currentYear = new Date().getFullYear();

        const emailContent = {
            sender: { name: "Vizit Support", email: process.env.SUPPORT_EMAIL },
            to: [{ email: userEmail, name: userName }],
            subject: "Welcome to Vizit! ",
            htmlContent: `
                <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; color: #333; line-height: 1.6;">
                    

                   <div style="background: url('https://res.cloudinary.com/dgigs6v72/image/upload/v1771837346/gd6kglmmwyn3n8bupxim.jpg'); background-size: cover; padding: 20px; width:100%; height:150px; text-align: center;">
                    </div>
                    <div style="background: #244531; padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Welcome to Vizit</h1>
                    </div>

                    <div style="padding: 40px; background: #ffffff; border: 1px solid #e0e0e0; border-top: none;">
                        <h2 style="color: #244531;">Hi ${userName},</h2>
                        <p>We're thrilled to have you on board! You've successfully created your account as a House Owner. Now you can start managing your listings and connecting with visitors effortlessly.</p>
                        
                        <p>To get started, we recommend completing your profile to build trust with potential visitors.</p>

                        <div style="text-align: center; margin: 35px 0;">
                            <a href="https://your-app-url.com/dashboard" 
                               style="background-color: #22c55e; color: white; padding: 14px 25px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block;">
                               Go to My Dashboard
                            </a>
                        </div>

                        <p style="font-size: 14px; color: #666;">
                            If you have any questions, simply reply to this email. Our support team is always here to help.
                        </p>
                    </div>

                    <div style="padding: 20px; text-align: center; font-size: 12px; color: #999;">
                        <p>© ${currentYear} Vizit Support. All rights reserved.</p>
                        <p>You received this email because you signed up for Vizit.</p>
                    </div>
                </div>
            `
        };

        await axios.post(url, emailContent, {
            headers: {
                "api-key": apiKey,
                "Content-Type": "application/json"
            }
        });

        console.log(`Welcome email sent to ${userEmail}`);
    } catch (error) {
        console.error("Welcome email failed:", error.response?.data || error.message);
    }
};


router.post("/register", async (req, res) => {
    try {
        let { name, email, password, location, bio, interest, IDno, profile, phone } = req.body; // Added phone back just in case

        // 1. Validation (Ensuring we don't check phone if it's not provided)
        if (!name || !email || !password || !location || !bio || !interest || !IDno) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (await HouseOwerModel.findOne({ email })) {
            return res.status(409).json({ message: "Email already exists" });
        }

        // 2. FIXED: Only check phone if a phone number was actually sent
        if (phone && await HouseOwerModel.findOne({ phone })) {
            return res.status(409).json({ message: "Phone number already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new HouseOwerModel({
            name,
            email,
            location,
            bio,
            interest,
            IDno,
            phone: phone || "", // Save as empty string if not provided
            password: hashedPassword,
            profile: profile || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`
        });

        const savedUser = await newUser.save();
        const token = generateToken(savedUser);


        sendWelcomeEmail(email, name); // Send welcome email asynchronously (fire and forget)
        res.status(201).json({ message: "Registration successful", token, newUser });
    } catch (err) {
        console.error("Registration error:", err); // Look at your Render logs to see this!
        res.status(500).json({ message: "Internal server error" });
    }
});
const sanitizeUser = (user) => {
    const obj = user.toObject();
    delete obj.password;
    return obj;
};


//login as owner
router.post("/login", async (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ message: "Email or phone number and password are required" });
        }

        const isEmail = validateEmail(identifier);
        const query = isEmail ? { email: identifier } : { phone: identifier };

        const user = await HouseOwerModel.findOne(query);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = generateToken(user);

        // Fire and forget email (or await it if you want to ensure it sends)
        sendBrevoEmail(user.email);

        return res.status(200).json({
            message: "Login successful",
            token,
            user: sanitizeUser(user),
        });

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});


// router.get("/decode/token/owner", async (req, res) => {
//     try {
//         const result = decodeTokenFromReq(req);

//         if (!result || !result.ok) {
//             return res.status(result?.status || 401).json({
//                 message: result?.message || "Failed to decode token"
//             });
//         }

//         const owner = await HouseOwerModel.findOne({ email: result.payload.email });

//         if (!owner) {
//             return res.status(404).json({ message: "Owner not found" });
//         }


//         if (
//             owner.verified &&
//             owner.verificationexpirydate &&
//             new Date() > owner.verificationexpirydate
//         ) {
//             owner.verified = false;
//             owner.verificationbalance = 0;
//             owner.dateofverification = null;
//             owner.verificationexpirydate = null;

//             await owner.save();
//         }

//         return res.status(200).json({ res: owner });

//     } catch (error) {
//         console.error("Token decode error:", error);
//         res.status(500).json({ message: "Internal server error" });
//     }
// });



router.get("/decode/token/owner", async (req, res) => {
    try {
        const result = decodeTokenFromReq(req);

        // 1. Check if token decoding was successful
        if (!result || !result.ok) {
            return res.status(result?.status || 401).json({
                message: result?.message || "Failed to decode token"
            });
        }

        // 2. Locate the owner using email (primary) or id (fallback)
        // Ensure result.payload contains the email field
        const query = result.payload.email
            ? { email: result.payload.email }
            : { _id: result.payload.id };

        // Note: Corrected "HouseOwerModel" to "HouseOwnerModel"
        const owner = await HouseOwerModel.findOne(query);

        if (!owner) {
            console.error("Owner lookup failed for query:", query);
            return res.status(404).json({ message: "Owner not found" });
        }

        // 3. Handle Verification Expiry Logic
        if (
            owner.verified &&
            owner.verificationexpirydate &&
            new Date() > new Date(owner.verificationexpirydate)
        ) {
            owner.verified = false;
            owner.verificationbalance = 0;
            owner.dateofverification = null;
            owner.verificationexpirydate = null;

            await owner.save();
        }

        // 4. Return the owner data
        return res.status(200).json({ res: owner });

    } catch (error) {
        console.error("Token decode error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


router.delete("/delete", async (req, res) => {
    try {

        await HouseOwerModel.deleteMany({});
        res.status(200).json({ message: "All owners deleted successfully" });
    } catch (error) {
        console.error("Delete error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.get("/allowners", async (req, res) => {
    try {
        const owners = await HouseOwerModel.find({});
        res.status(200).json({ owners });
    }
    catch (error) {
        console.error("Fetch all owners error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});







router.put("/edit/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const {
            Notifications,
            name,
            email,
            profile,
            location,
            companyname,
            bio,
            phone,
            IDno,
            paymentmethod,
            enabletwofactor
        } = req.body;

        const updatedUser = await HouseOwerModel.findByIdAndUpdate(
            id,
            {
                $set: {
                    Notifications,
                    name,
                    email,
                    profile,
                    location,
                    companyname,
                    bio,
                    phone,
                    IDno,
                    paymentmethod,
                    enabletwofactor
                }
            },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            message: "User updated successfully",
            user: updatedUser
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});





















router.put("/add/chat/idnow/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { chatId } = req.body;

        // Validate input
        if (!chatId) {
            return res.status(400).json({
                message: "chatId is required"
            });
        }

        // Atomic update: add chatId only if it doesn't exist
        const user = await HouseOwerModel.findByIdAndUpdate(
            id,
            {
                $addToSet: {
                    allchatsId: String(chatId)
                }
            },
            {
                new: true,       // return updated document
                runValidators: true
            }
        );

        // User not found
        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.status(200).json({
            message: "Chat added successfully",
            allchatsId: user.allchatsId
        });

    } catch (error) {
        console.error("Add chat error:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
});


// router.put("/add/chat/id/:id", async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { chatId } = req.body;

//         if (!chatId) {
//             return res.status(400).json({ message: "chatId is required" });
//         }

//         /* --------------------------------
//            1. Try USER first (uses lowercase c)
//         -------------------------------- */
//         const userResult = await UserModel.updateOne(
//             { _id: id },
//             { $addToSet: { allchatsId: String(chatId) } }
//         );

//         if (userResult.matchedCount > 0) {
//             return res.status(200).json({
//                 message: "Chat added to user successfully",
//                 model: "user"
//             });
//         }

//         /* --------------------------------
//            2. Try HOUSE OWNER (Fixed to capital C)
//         -------------------------------- */
//         const ownerResult = await HouseOwnerModel.updateOne(
//             { _id: id },
//             { $addToSet: { allChatsId: String(chatId) } } // Fixed: allChatsId
//         );

//         if (ownerResult.matchedCount > 0) {
//             return res.status(200).json({
//                 message: "Chat added to owner successfully",
//                 model: "houseowner"
//             });
//         }

//         return res.status(404).json({ message: "User or House Owner not found" });

//     } catch (error) {
//         console.error("Add chat error:", error);
//         res.status(500).json({ message: "Internal server error" });
//     }
// });



router.put("/add/chat/id/:id", async (req, res) => {
    try {
        const { id } = req.params;      // The person's ID (the one we are updating)
        const { chatId } = req.body;    // The other person's ID (the one we are adding to the list)

        // Basic check to prevent 500 errors on invalid ObjectIds
        if (id.length !== 24 || chatId.length !== 24) {
            return res.status(400).json({ message: "Invalid ID format" });
        }

        // Try updating Seeker/User (lowercase field)
        const userUpdate = await UserModel.updateOne(
            { _id: id },
            { $addToSet: { allchatsId: String(chatId) } }
        );

        if (userUpdate.matchedCount > 0) {
            return res.status(200).json({ message: "Updated Seeker List" });
        }

        // Try updating Owner (Capital C field)
        const ownerUpdate = await HouseOwerModel.updateOne(
            { _id: id },
            { $addToSet: { allChatsId: String(chatId) } }
        );

        if (ownerUpdate.matchedCount > 0) {
            return res.status(200).json({ message: "Updated Owner List" });
        }

        res.status(404).json({ message: "User/Owner not found" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server Error" });
    }
});



export default router;