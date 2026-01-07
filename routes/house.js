import express from "express";
import HouseModel from "../models/HousePosts.js";
import mongoose from "mongoose";

const router = express.Router();

/**
 * Create a new house post
 */
router.post("/houses", async (req, res) => {
    try {
        const newHouse = new HouseModel(req.body);
        const save = await newHouse.save();
        if (!save) {
            return res.status(500).json({ message: "Failed to create house" });
        }
        res.status(201).json({ message: "House created successfully", house: newHouse });
    } catch (err) {
        console.error("Create house error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});



//post reviews


router.post("/houses/review/post/:id", async (req, res) => {
    const { id } = req.params;
    const { reviewdata } = req.body;
    try {
        const house = await HouseModel.findById(id);
        if (!house) {
            return res.status(404).json({ message: "House not found" });
        }

        // Prevent multiple reviews from the same user
        const existingReview = house.reviews.entries.find(
            (r) => r.id.toString() === reviewdata.userId
        );
        if (existingReview) {
            return res.status(400).json({ message: "You have already reviewed this property" });
        }

        // Add new review to entries
        const newReview = {
            id: reviewdata.userId,
            name: reviewdata.name,
            profileImg: reviewdata.profileImg || "", // use profileImg
            rating: reviewdata.rating,
            comment: reviewdata.comment || "", // <-- add this
            replies: [],
            createdAt: new Date(),
        };


        house.reviews.entries.push(newReview);

        // Recalculate overallRating and totalReviews
        const totalReviews = house.reviews.entries.length;
        const overallRating =
            house.reviews.entries.reduce((sum, r) => sum + r.rating, 0) / totalReviews;

        house.reviews.totalReviews = totalReviews;
        house.reviews.overallRating = Number(overallRating.toFixed(1));

        await house.save();

        res.status(201).json({
            message: "Review added successfully",
            reviews: house.reviews,
        });
    } catch (err) {
        console.error("Add review error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});



//reply to reviews as admin only

// router.post("/houses/review/:id", async (req, res) => {
//     const { id } = req.params;
//     const { reviewdata } = req.body;

//     try {
//         const house = await HouseModel.findById(id);
//         if (!house) {
//             return res.status(404).json({ message: "House not found" });
//         }

//         // Ensure structure exists
//         if (!house.reviews) {
//             house.reviews = { overallRating: 0, totalReviews: 0, entries: [] };
//         }

//         // Prevent duplicate reviews
//         const alreadyReviewed = house.reviews.entries.find(
//             r => r.id.toString() === reviewdata.userId
//         );
//         if (alreadyReviewed) {
//             return res.status(400).json({ message: "You already reviewed this house" });
//         }

//         const newReview = {

//             id: reviewdata.userId,
//             name: reviewdata.name,
//             profileImg: reviewdata.profile || "",
//             rating: reviewdata.rating,
//             comment: reviewdata.comment,
//             replies: []
//         };

//         house.reviews.entries.push(newReview);

//         house.reviews.totalReviews = house.reviews.entries.length;
//         house.reviews.overallRating =
//             house.reviews.entries.reduce((s, r) => s + r.rating, 0) /
//             house.reviews.totalReviews;

//         await house.save();

//         res.status(201).json({
//             message: "Review added successfully",
//             review: newReview,
//             reviews: house.reviews
//         });

//     } catch (err) {
//         console.error("Add review error:", err);
//         res.status(500).json({ message: "Internal server error" });
//     }
// });
// POST /houses/review/reply/:houseId
router.post("/houses/review/reply/:houseId", async (req, res) => {
    const { houseId } = req.params;
    const { reviewId, userId, isAdmin, text, name, email, profileImg } = req.body;

    try {
        const house = await HouseModel.findById(houseId);
        if (!house) return res.status(404).json({ message: "House not found" });

        // Find the review
        const review = house.reviews.entries.find(r => r._id.toString() === reviewId);
        if (!review) return res.status(404).json({ message: "Review not found" });

        // Add reply
        const newReply = {
            _id: new mongoose.Types.ObjectId(),
            userId,
            isAdmin: Boolean(isAdmin),
            text,
            name,
            email: email || "",
            profileImg: profileImg || "",
            createdAt: new Date(),
        };

        if (!Array.isArray(review.replies)) review.replies = [];
        review.replies.push(newReply);

        await house.save();

        return res.status(201).json({
            message: "Reply added successfully",
            review,
        });
    } catch (err) {
        console.error("Add reply error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
});




//delete reveiw by the house id ad userid
router.delete("/houses/review/:houseId/:reviewId", async (req, res) => {
    try {
        const { houseId, reviewId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(houseId)) {
            return res.status(400).json({ message: "Invalid house ID" });
        }

        const house = await HouseModel.findById(houseId);
        if (!house) {
            return res.status(404).json({ message: "House not found" });
        }

        if (!house.reviews || !Array.isArray(house.reviews.entries)) {
            return res.status(400).json({ message: "Reviews not found" });
        }

        // Find and remove review by ID
        const reviewIndex = house.reviews.entries.findIndex(
            (r) => r._id.toString() === reviewId
        );

        if (reviewIndex === -1) {
            return res.status(404).json({ message: "Review not found" });
        }

        house.reviews.entries.splice(reviewIndex, 1);

        // Recalculate ratings
        const totalReviews = house.reviews.entries.length;
        if (totalReviews > 0) {
            house.reviews.overallRating =
                house.reviews.entries.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
            house.reviews.overallRating = Number(house.reviews.overallRating.toFixed(1));
        } else {
            house.reviews.overallRating = 0;
        }
        house.reviews.totalReviews = totalReviews;

        await house.save();

        res.status(200).json({
            message: "Review deleted successfully",
            reviews: house.reviews
        });

    } catch (error) {
        console.error("Delete review error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});






router.put("/houses/review/:houseId/:reviewId", async (req, res) => {
    const { houseId, reviewId } = req.params;
    const { reviewdata } = req.body;

    try {
        const house = await HouseModel.findById(houseId);
        if (!house) {
            return res.status(404).json({ message: "House not found" });
        }

        // Ensure reviews exist
        if (!house.reviews || !Array.isArray(house.reviews.entries)) {
            return res.status(400).json({ message: "Reviews not initialized" });
        }

        // Find review
        const review = house.reviews.entries.id(reviewId);
        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }

        // Authorization check (review owner only)
        if (review.id.toString() !== reviewdata.userId) {
            return res.status(403).json({ message: "Not allowed to edit this review" });
        }

        // Update fields
        review.rating = reviewdata.rating;
        review.comment = reviewdata.comment;
        review.updatedAt = new Date();

        // Recalculate ratings
        const totalReviews = house.reviews.entries.length;
        const overallRating =
            house.reviews.entries.reduce((sum, r) => sum + r.rating, 0) / totalReviews;

        house.reviews.totalReviews = totalReviews;
        house.reviews.overallRating = Number(overallRating.toFixed(1));

        await house.save();

        res.status(200).json({
            message: "Review updated successfully",
            reviews: house.reviews
        });

    } catch (err) {
        console.error("Update review error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});


//delete

//change the state of canedit

router.put("/checkingoh/:houseId", async (req, res) => {
    try {
        const { houseId } = req.params;
        const { allow } = req.body;

        if (typeof allow !== "boolean") {
            return res.status(400).json({ message: "allow must be boolean" });
        }

        const updatedHouse = await HouseModel.findByIdAndUpdate(
            houseId,
            {
                $set: {
                    "reviews.canEdit": allow
                }
            },
            { new: true }
        );

        if (!updatedHouse) {
            return res.status(404).json({ message: "House not found" });
        }

        res.status(200).json({
            message: "Review edit permission updated",
            canEdit: updatedHouse.reviews.canEdit
        });
    } catch (error) {
        console.error("checkingoh error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});





//check house owner


router.post("/check/:houseId/:ownerId", async (req, res) => {
    try {
        const { houseId, ownerId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(houseId)) {
            return res.status(400).json({ message: "Invalid house ID" });
        }

        const house = await HouseModel.findById(houseId);
        if (!house) {
            return res.status(404).json({ message: "House not found" });
        }

        const isOwner = house.owner.id.toString() === ownerId;


        res.status(200).json({
            message: "House ownership check completed",
            isOwner,
            canEdit: isOwner
        });

    } catch (error) {
        console.error("House ownership check error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});







router.put("/houses/update/:id", async (req, res) => {
    const allowedUpdates = {
        // disable: req.body.disable,
        isAvalable: req.body.isAvalable,
    };

    const updatedHouse = await HouseModel.findByIdAndUpdate(
        req.params.id,
        { $set: allowedUpdates },
        { new: true }
    );

    res.json({ message: "House updated", house: updatedHouse });
});


router.delete("/houses/:id", async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid house ID" });
    }

    try {
        const deletedHouse = await HouseModel.findByIdAndDelete(id);
        if (!deletedHouse) {
            return res.status(404).json({ message: "House not found" });
        }
        res.status(200).json({ message: "House deleted successfully" });
    } catch (err) {
        console.error("Delete house error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * Get all houses (optional filtering)
 * 
 * 
 * gBLzrqc4qFBXXD0i homesvizit_db_user
 */
router.get("/houses", async (req, res) => {
    try {
        const houses = await HouseModel.find({ disable: false }).sort({ createdAt: -1 });
        res.status(200).json({ houses });
    } catch (err) {
        console.error("Get houses error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

/**
 * Get a single house by ID
 */
router.get("/houses/:id", async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid house ID" });
    }

    try {
        const house = await HouseModel.findById(id);
        if (!house) {
            return res.status(404).json({ message: "House not found" });
        }
        res.status(200).json({ house });
    } catch (err) {
        console.error("Get house error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.delete("/houses", async (req, res) => {
    try {
        await HouseModel.deleteMany({});
        res.status(200).json({ message: "All houses deleted successfully" });
    } catch (error) {
        console.error("Delete all houses error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});



//fetch and filter property per user

// router.get("/houses/getting/:ownerId", async (req, res) => {
//     try {
//         const { ownerId } = req.params;
//         const houses = await HouseModel.find({})

//         if (houses) {
//             return res.status(404).json({ message: "no house found" })
//         }
//         //filter houses and only fetch houses with thesame owner id
//         const userHouses = houses.filter(house => house.owner.id.toString() === ownerId);

//         if (userHouses.length === 0) {
//             return res.status(404).json({ message: "No houses found for this owner" });
//         }

//         res.status(200).json({ houses: userHouses });


//     } catch (error) {
//         res.status(500).json({ message: "internal server error" })
//         console.log('====================================');
//         console.log(error);
//         console.log('====================================');
//     }
// })





router.get("/houses/getting/:ownerId", async (req, res) => {
    try {
        const { ownerId } = req.params;

        const houses = await HouseModel.find({
            "owner.id": ownerId
        });

        if (houses.length === 0) {
            return res.status(404).json({
                message: "No houses found for this owner"
            });
        }

        res.status(200).json({ houses });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});



export default router;
