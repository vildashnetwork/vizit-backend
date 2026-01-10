import Apoitment from "../models/apoitment.js";
import express from "express"

const router = express.Router();

// Create a new appointment
router.post("/", async (req, res) => {
    try {

        const newApoitment = new Apoitment(req.body);
        const finduserId = await Apoitment.findOne({ userID: req.body.userID, listingId: req.body.listingId });
        if (finduserId) {
            return res.status(400).json({ message: "Appointment already exists for this user and listing." });
        }

        const savedApoitment = await newApoitment.save();
        res.status(201).json(savedApoitment);
    } catch (err) {
        res.status(500).json(err);
    }
});

//update apointment
router.put("/:id", async (req, res) => {
    try {
        const updatedApoitment = await Apoitment.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        );
        res.status(200).json(updatedApoitment);
    }
    catch (err) {
        res.status(500).json(err);
    }

});

// Get all appointments
router.get("/", async (req, res) => {
    try {
        const apoitments = await Apoitment.find();
        res.status(200).json(apoitments);
    } catch (err) {
        res.status(500).json(err);
    }
});
//get apointment by owners id
router.get("/owner/:ownerID", async (req, res) => {
    try {
        const apoitments = await Apoitment.find({ ownerID: req.params.ownerID });
        res.status(200).json(apoitments);
    } catch (err) {
        res.status(500).json(err);
    }

});
//get apointment by user id
router.get("/user/:userID", async (req, res) => {
    try {
        const apoitments = await Apoitment.find({ userID: req.params.userID });
        res.status(200).json(apoitments);
    } catch (err) {
        res.status(500).json(err);
    }
});
// to delete apointment
router.delete("/:id", async (req, res) => {
    try {
        await Apoitment.findByIdAndDelete(req.params.id);
        res.status(200).json("Appointment has been deleted...");
    } catch (err) {
        res.status(500).json(err);
    }
});


export default router;