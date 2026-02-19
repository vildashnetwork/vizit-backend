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


const generateToken = (user) => {
    return jwt.sign(
        { id: user._id, email: user.email, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: "15d" }
    );
};


//regex to validate the email format 

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);


router.post("/register", async (req, res) => {
    try {
        // extract fields and normalize interest to an array of strings
        let { name, email, password, location,
            companyname, bio, phone, interest, IDno, profile } = req.body;




        if (!name || !email || !password || !location ||
            !companyname || !bio || !phone || !interest || !IDno) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Validate email format
        if (!validateEmail(email)) {
            return res.status(400).json({ message: "Invalid email format" });
        }



        // Check if email exists
        if (await HouseOwerModel.findOne({ email })) {
            return res.status(409).json({ message: "Email already exists" });
        }
        if (await UserModel.findOne({ email })) {
            return res.status(409).json({ message: "What are you doing this email account is already a house seeker" });
        }

        // Check if phone exists
        if (await HouseOwerModel.findOne({ phone })) {
            return res.status(409).json({ message: "Phone number already exists" });
        }

        if (await UserModel.findOne({ phone })) {
            return res.status(409).json({ message: "What are you doing this phone account is already a house seeker" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const newUser = new HouseOwerModel({
            name,
            email,
            location,
            companyname,
            bio,
            phone,
            interest,
            IDno,
            password: hashedPassword,
            profile: profile || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`
        });



        const savedUser = await newUser.save();

        const token = generateToken(savedUser);

        res.status(201).json({
            message: "Registration successful",
            token,
            newUser
        });
    } catch (err) {
        console.error("Registration error:", err);
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
            return res.status(400).json({
                message: "Email or phone number and password are required",
            });
        }

        const isEmail = validateEmail(identifier);
        const query = isEmail
            ? { email: identifier }
            : { phone: identifier }; // ⚠️ use phone, not number

        const user = await HouseOwerModel.findOne(query);

        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = generateToken(user);

        res.status(200).json({
            message: "Login successful",
            token,
            user: sanitizeUser(user),
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});


router.get("/decode/token/owner", async (req, res) => {
    try {
        const result = decodeTokenFromReq(req);

        if (!result || !result.ok) {
            return res.status(result?.status || 401).json({
                message: result?.message || "Failed to decode token"
            });
        }

        const owner = await HouseOwerModel.findOne({ email: result.payload.email });

        if (!owner) {
            return res.status(404).json({ message: "Owner not found" });
        }


        if (
            owner.verified &&
            owner.verificationexpirydate &&
            new Date() > owner.verificationexpirydate
        ) {
            owner.verified = false;
            owner.verificationbalance = 0;
            owner.dateofverification = null;
            owner.verificationexpirydate = null;

            await owner.save();
        }

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


router.put("/add/chat/id/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { chatId } = req.body;

        if (!chatId) {
            return res.status(400).json({ message: "chatId is required" });
        }

        /* --------------------------------
           1. Try USER first
        -------------------------------- */
        const userResult = await UserModel.updateOne(
            { _id: id },
            { $addToSet: { allchatsId: String(chatId) } }
        );

        if (userResult.matchedCount > 0) {
            return res.status(200).json({
                message: "Chat added to user successfully",
                model: "user"
            });
        }

        /* --------------------------------
           2. Try HOUSE OWNER
        -------------------------------- */
        const ownerResult = await HouseOwerModel.updateOne(
            { _id: id },
            { $addToSet: { allchatsId: String(chatId) } }
        );

        if (ownerResult.matchedCount > 0) {
            return res.status(200).json({
                message: "Chat added to owner successfully",
                model: "houseowner"
            });
        }

        /* --------------------------------
           3. Not found in both
        -------------------------------- */
        return res.status(404).json({
            message: "User or House Owner not found"
        });

    } catch (error) {
        console.error("Add chat error:", error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
});











export default router;