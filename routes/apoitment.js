import Apoitment from "../models/apoitment.js";
import express from "express"

const router = express.Router();

// Create a new appointment
router.post("/", async (req, res) => {
    try {
        const newApoitment = new Apoitment(req.body);
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

export default router;