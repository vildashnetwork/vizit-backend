import express from "express";
import HouseModel from "../models/HousePosts.js";
import mongoose from "mongoose";
import HouseOwnerModel from "../models/HouseOwners.js";
import axios from "axios"
const router = express.Router();



const AI_PROVIDERS = [
    {
        name: 'Gemini',
        key: process.env.AI_KEY_1,
        baseURL: process.env.AI_BASE_1,
        model: process.env.AI_MODEL_1,
        headers: (key) => ({
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
        })
    },
    {
        name: 'OpenRouter',
        key: process.env.AI_KEY_2,
        baseURL: process.env.AI_BASE_2,
        model: process.env.AI_MODEL_2,
        headers: (key) => ({
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
        })
    },
    {
        name: 'Cerebras',
        key: process.env.AI_API_KEY_3,
        baseURL: process.env.AI_BASE_URL_3,
        model: process.env.AI_MODEL_3,
        headers: (key) => ({
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
        })
    },
    {
        name: 'Mistral',
        key: process.env.AI_API_KEY_4,
        baseURL: process.env.AI_BASE_URL_4,
        model: process.env.AI_MODEL_4,
        headers: (key) => ({
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
        })
    },
    {
        name: 'Groq',
        key: process.env.AI_API_KEY,
        baseURL: process.env.AI_BASE_URL,
        model: process.env.AI_MODEL,
        headers: (key) => ({
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
        })
    }
];

/**
 * Call AI with fallback mechanism
 */
async function callAIFallback(prompt, retryCount = 0) {
    for (let i = 0; i < AI_PROVIDERS.length; i++) {
        const provider = AI_PROVIDERS[i];
        try {
            console.log(`Attempting with provider: ${provider.name} (Attempt ${retryCount + 1})`);

            const response = await axios.post(
                `${provider.baseURL}/chat/completions`,
                {
                    model: provider.model,
                    messages: [
                        {
                            role: "system",
                            content: "You are an AI that analyzes and sorts reviews. Return only valid JSON without any markdown formatting or additional text."
                        },
                        {
                            role: "user",
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 2000
                },
                {
                    headers: provider.headers(provider.key),
                    timeout: 15000
                }
            );

            if (response.data?.choices?.[0]?.message?.content) {
                let content = response.data.choices[0].message.content;
                // Clean up markdown if present
                content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const parsed = JSON.parse(content);
                console.log(`Successfully used provider: ${provider.name}`);
                return parsed;
            }
        } catch (error) {
            console.error(`Provider ${provider.name} failed:`, error.message);
            continue;
        }
    }

    // If all providers fail and we haven't retried too many times
    if (retryCount < 2) {
        console.log(`All providers failed, retrying (${retryCount + 1}/2)...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return callAIFallback(prompt, retryCount + 1);
    }

    throw new Error("All AI providers failed to respond");
}

/**
 * AI-powered review sorting for verified houses
 */
async function sortReviewsWithAI(reviews, houseTitle, houseLocation, ownerName = '') {
    if (!reviews || reviews.length === 0) return reviews;

    const prompt = `
    Analyze and sort these property reviews. Return ONLY valid JSON.
    
    Property: "${houseTitle}" located in "${houseLocation}"
    ${ownerName ? `Owner: ${ownerName}` : ''}
    
    Reviews:
    ${JSON.stringify(reviews.map((r, i) => ({
        id: i,
        rating: r.rating,
        text: r.comment || r.text || '',
        date: r.createdAt || r.date,
        helpfulCount: r.helpful || 0
    })), null, 2)}
    
    Sort criteria (in order of importance):
    1. High-quality reviews (4-5 stars with detailed, helpful comments about the property)
    2. Recent reviews (prioritize last 30 days)
    3. Reviews marked as helpful by other users
    4. Reviews with specific details about amenities, location, neighborhood, or landlord responsiveness
    5. Lower priority: Vague comments (e.g., "good", "nice"), negative reviews without constructive feedback
    
    Return JSON format:
    {
        "sortedIndices": [0, 2, 1, 3, ...],
        "reasoning": "brief explanation of sorting logic"
    }
    `;

    try {
        const result = await callAIFallback(prompt);
        if (result && Array.isArray(result.sortedIndices)) {
            // Validate indices are within bounds
            const validIndices = result.sortedIndices.filter(i => i >= 0 && i < reviews.length);
            if (validIndices.length === reviews.length) {
                return validIndices.map(i => reviews[i]);
            }
        }
        // Fallback to manual sorting if AI returns invalid data
        console.log("AI returned invalid indices, using manual sort");
        return manualReviewSort(reviews);
    } catch (error) {
        console.error("AI review sorting failed, using manual sort:", error);
        return manualReviewSort(reviews);
    }
}

/**
 * Manual review sorting (fallback when AI fails)
 */
function manualReviewSort(reviews) {
    return [...reviews].sort((a, b) => {
        // Sort by rating (higher first)
        if (a.rating !== b.rating) {
            return (b.rating || 0) - (a.rating || 0);
        }
        // Then by helpful count (higher first)
        if ((a.helpful || 0) !== (b.helpful || 0)) {
            return (b.helpful || 0) - (a.helpful || 0);
        }
        // Then by date (newer first)
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
    });
}

/**
 * Get owner details for multiple houses
 */
async function getOwnerDetails(ownerIds) {
    const uniqueOwnerIds = [...new Set(ownerIds.filter(id => id))];
    const owners = await HouseOwnerModel.find({
        _id: { $in: uniqueOwnerIds }
    }).select('_id name email isVerified phone');

    const ownerMap = {};
    owners.forEach(owner => {
        ownerMap[owner._id.toString()] = owner;
    });

    return ownerMap;
}

/**
 * Get all houses (disabled = false) with AI-sorted reviews for verified properties
 */
router.get("/houses", async (req, res) => {
    try {
        // Fetch only enabled houses
        const houses = await HouseModel.find({ disable: false }).sort({ createdAt: -1 });

        if (!houses || houses.length === 0) {
            return res.status(200).json({ houses: [] });
        }

        // Collect all owner IDs to fetch their verification status
        const ownerIds = houses.map(house => house.ownerId).filter(id => id);
        const ownerMap = await getOwnerDetails(ownerIds);

        // Process each house to sort reviews using AI for verified houses
        const processedHouses = await Promise.all(
            houses.map(async (house) => {
                const houseObj = house.toObject();
                const owner = ownerMap[house.ownerId?.toString()];

                // Only apply AI sorting if house has reviews and owner is verified
                if (houseObj.reviews && houseObj.reviews.length > 0 && owner?.isVerified === true) {
                    try {
                        console.log(`AI sorting reviews for verified house: ${houseObj.title} (${house._id})`);
                        const sortedReviews = await sortReviewsWithAI(
                            houseObj.reviews,
                            houseObj.title,
                            houseObj.location?.address || houseObj.location || 'Unknown location',
                            owner?.name || ''
                        );
                        houseObj.reviews = sortedReviews;
                        houseObj.reviewsAISorted = true;
                    } catch (error) {
                        console.error(`AI sorting failed for house ${house._id}:`, error);
                        // Keep original reviews but mark as manually sorted
                        houseObj.reviews = manualReviewSort(houseObj.reviews);
                        houseObj.reviewsAISorted = false;
                    }
                } else if (houseObj.reviews && houseObj.reviews.length > 0) {
                    // For non-verified owners or houses without owner, use manual sorting
                    houseObj.reviews = manualReviewSort(houseObj.reviews);
                    houseObj.reviewsAISorted = false;
                }

                // Add owner verification status to response
                if (owner) {
                    houseObj.ownerVerified = owner.isVerified || false;
                    houseObj.ownerName = owner.name;
                    houseObj.ownerEmail = owner.email;
                }

                return houseObj;
            })
        );

        res.status(200).json({
            houses: processedHouses,
            total: processedHouses.length,
            aiEnabled: true
        });
    } catch (err) {
        console.error("Get houses error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});






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
        const house = await HouseModel.findById(id).sort({ createdAt: -1 });;
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



// update  house details by the owner only
router.put("/houses/:id", async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid house ID" });
    }

    try {
        const updatedHouse = await HouseModel.findByIdAndUpdate(
            id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!updatedHouse) {
            return res.status(404).json({ message: "House not found" });
        }

        res.status(200).json({ message: "House updated successfully", house: updatedHouse });
    } catch (err) {
        console.error("Update house error:", err);
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
// router.get("/houses", async (req, res) => {
//     try {
//         const houses = await HouseModel.find({ disable: false }).sort({ createdAt: -1 });
//         res.status(200).json({ houses });
//     } catch (err) {
//         console.error("Get houses error:", err);
//         res.status(500).json({ message: "Internal server error" });
//     }
// });

/**
 * Get a single house by ID
 */
router.get("/houses/:id", async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid house ID" });
    }

    try {
        const house = await HouseModel.findById(id).sort({ createdAt: -1 });
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
