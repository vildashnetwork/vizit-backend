import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import UserModel from "../models/Users.js";
import mongoose from "mongoose"
import decodeTokenFromReq from "./decode.js";
import HouseOwerModel from "../models/HouseOwners.js";

dotenv.config();

const router = express.Router();
const SALT_ROUNDS = 10;

/* ----------------------------------
   Helpers
----------------------------------- */

// Ensure JWT secret exists
if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in environment variables");
}

const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            name: user.name,
        },
        process.env.JWT_SECRET,
        { expiresIn: "15d" }
    );
};

const validateEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const sanitizeUser = (user) => {
    const { password, __v, ...safeUser } = user.toObject();
    return safeUser;
};

/* ----------------------------------
   REGISTER
----------------------------------- */
router.post("/register", async (req, res) => {
    try {
        let { name, email, number, profile, password, interest } = req.body;

        // Basic validation
        if (!name || !password || !number || !interest) {
            return res.status(400).json({
                message: "All fields are required",
            });
        }


        // Email format check
        if (!validateEmail(email)) {
            return res.status(400).json({
                message: "Invalid email format",
            });
        }

        // Password strength
        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters",
            });
        }

        // Check email uniqueness
        const existingEmail = await UserModel.findOne({ email });
        if (existingEmail) {
            return res.status(409).json({
                message: "Email already exists",
            });
        }

        // Check phone uniqueness
        const existingPhone = await UserModel.findOne({ number });
        if (existingPhone) {
            return res.status(409).json({
                message: "Phone number already exists",
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Create user
        const newUser = new UserModel({
            name,
            email,
            number,
            interest,
            password: hashedPassword,
            profile:
                profile ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
                    name
                )}`,
        });

        const savedUser = await newUser.save();
        const token = generateToken(savedUser);

        res.status(201).json({
            message: "Registration successful",
            token,
            user: sanitizeUser(savedUser),
        });
    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({
            message: err?.message,
        });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { identifier, password } = req.body;

        // Validate input
        if (!identifier || !password) {
            return res.status(400).json({
                message: "Email or phone number and password are required",
            });
        }
        const isEmail = validateEmail(identifier);
        const query = isEmail ? { email: identifier } : { number: identifier };

        // Find user by email or phone number
        const user = await UserModel.findOne(query);

        if (!user) {
            return res.status(401).json({
                message: "Invalid credentials",

            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid credentials",
            });
        }

        const token = generateToken(user);

        res.status(200).json({
            message: "Login successful",
            token,
            user: sanitizeUser(user),
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({
            message: "Internal server error",
        });
    }
});

router.get("/decode/token/user", async (req, res) => {
    try {
        // call decode helper with the full request so it can check body, headers or cookies
        const result = decodeTokenFromReq(req);
        if (!result || !result.ok) {
            return res.status(result && result.status ? result.status : 401).json({ message: result && result.message ? result.message : "Failed to decode token" });
        }
        // return res.status(200).json({ data: result.payload });
        //find user by id from payload
        const user = await UserModel.findById(result.payload.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json({ user: sanitizeUser(user) });
    }
    catch (error) {
        console.error("Token decode error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});



//get all users"

router.get("/all", async (req, res) => {
    try {
        const users = await UserModel.find({});
        res.status(200).json(users);
    } catch (err) {
        console.error("Fetch users error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});



router.delete("/all", async (req, res) => {
    try {
        const users = await UserModel.deleteMany({});
        res.status(201).json({ message: "alll deleted" });
    } catch (err) {
        console.error("Fetch users error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});



router.put("/edt/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const {
            Notifications,
            name,
            email,
            profile
        } = req.body;

        const updatedUser = await UserModel.findByIdAndUpdate(
            id,
            {
                $set: {
                    Notifications,
                    name,
                    email,
                    profile
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


//save houses
router.put("/save/house/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { houseId } = req.body;
        const user = await UserModel.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const isHouseSaved = user.savedHouses.includes(houseId);
        if (isHouseSaved) {
            return res.status(400).json({ message: "House already saved" });
        }
        const updatedUser = await UserModel.findByIdAndUpdate(
            id,
            { $push: { savedHouses: houseId } },
            { new: true }
        );
        res.status(200).json({
            message: "House saved successfully",
            user: updatedUser
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});

//get saved house ids
router.get("/saved/houses/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const user = await UserModel.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({ savedHouses: user.savedHouses });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});


// remove saved listings 
router.put("/remove/saved/house/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { houseId } = req.body;
        const user = await UserModel.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const isHouseSaved = user.savedHouses.includes(houseId);
        if (!isHouseSaved) {
            return res.status(400).json({ message: "House not found in saved list" });
        }
        const updatedUser = await UserModel.findByIdAndUpdate(
            id,
            { $pull: { savedHouses: houseId } },
            { new: true }
        );
        res.status(200).json({
            message: "House removed from saved list successfully",
            user: updatedUser
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});












router.put("/add/chat/id/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { chatId } = req.body;

        if (!chatId) {
            return res.status(400).json({ message: "chatId is required" });
        }

        const user = await UserModel.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Ensure array exists
        let chats = Array.isArray(user.allchatsId)
            ? user.allchatsId.map(String)
            : [];

        const chatIdStr = String(chatId);

        // Add only if not included
        if (!chats.includes(chatIdStr)) {
            chats.push(chatIdStr);
        }

        // Remove duplicates (safety net)
        chats = [...new Set(chats)];

        user.allchatsId = chats;
        await user.save();

        res.status(200).json({
            message: "Chat processed successfully",
            allchatsId: user.allchatsId
        });

    } catch (error) {
        console.error("Add chat error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.get("/me/:email", async (req, res) => {
    try {
        const { email } = req.params;

        // Check normal user
        let user = await UserModel.findOne({ email }).lean(); // convert to plain JS object
        if (user) {
            delete user.password; // remove sensitive field
            return res.status(200).json({ user, role: "user" });
        }

        // Check house owner
        let owner = await HouseOwerModel.findOne({ email }).lean(); // convert to plain JS object
        if (owner) {
            delete owner.password; // remove sensitive field
            return res.status(200).json({ user: owner, role: "owner" });


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

        }

        return res.status(404).json({ message: "No user found with this email" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});



router.get("/onlyme/:id", async (req, res) => {
    try {
        const { id } = req.params
        const getuser = await UserModel.findOne({ _id: id })

        if (getuser) {
            res.status(200).json({ getuser })
        } else {
            res.status(404).json({ message: "user not found" })
        }

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "internal server error" })
    }
})


export default router;