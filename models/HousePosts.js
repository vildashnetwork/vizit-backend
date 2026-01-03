import mongoose from "mongoose"

//owners credentials
const User = new mongoose.Schema({
    id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    profile: {
        type: String,
        required: true
    }

})



const HousePosts = new mongoose.Schema({

    owner: User,

    type: {
        type: String,
        enum: ["Apartment", "Guest House", "Hotel", "Modern Room", "Studio"],
        default: "Apartment"
    },
    image: {
        type: String,
        default: ""
    },
    title: {
        type: String,
        default: "",
    },
    how: {
        type: String,
        default: "month"
    },

    location: {
        address: {
            type: String,
            required: true
        },
        coordinates: {
            lat: {
                type: Number,
                required: true
            },
            lng: {
                type: Number,
                required: true
            },

        }
    },


    rent: {
        type: String,
        required: true
    },
    bedrooms: {
        type: Number,
        required: true
    },
    bathrooms: {
        type: Number,
        required: true
    },
    area_sqm: {
        type: Number,
        required: true
    },
    amenities: {
        type: [String],
        default: []
    },
    disable: {
        type: Boolean,
        default: false
    },
    minimumduration: {
        type: String,
        required: true
    },
    isAvalable: {
        type: Boolean,
        default: false
    },
    description: {
        type: String,
        default: ""
    },
    // reviews: {
    //     overallRating: {
    //         type: Number,
    //         default: 0
    //     },
    //     totalReviews: {
    //         type: Number,
    //         default: 0
    //     },

    //     entries: {

    //         id: {
    //             type: mongoose.Schema.Types.ObjectId,
    //             ref: "User",
    //         },
    //         name: {
    //             type: String,
    //             default: ""
    //         },
    //         profileImg: {
    //             type: String,
    //             default: ""
    //         },
    //         createdAt: {
    //             type: Date,
    //             default: Date.now
    //         },
    //         rating: {
    //             type: Number,
    //             default: 0
    //         },
    //         comment: {
    //             type: String,
    //             default: ""
    //         },
    //         replies: [
    //             {
    //                 id: {
    //                     type: mongoose.Schema.Types.ObjectId,
    //                     ref: "User",
    //                 },
    //                 isAdmin: {
    //                     type: Boolean,
    //                     default: false
    //                 },
    //                 text: {
    //                     type: String,
    //                     default: ""
    //                 },
    //                 name: {
    //                     type: String,
    //                     default: ""
    //                 },

    //                 email: {
    //                     type: String,
    //                     default: ""
    //                 },
    //                 profileImg: {
    //                     type: String,
    //                     default: ""
    //                 },
    //                 createdAt: {
    //                     type: Date,
    //                     default: Date.now
    //                 }


    //             }
    //         ]

    //     },


    //     images: {
    //         type: [String],
    //         default: []
    //     }

    // }


    reviews: {
        overallRating: {
            type: Number,
            default: 0
        },
        totalReviews: {
            type: Number,
            default: 0
        },
        canEdit: {
            type: Boolean,
            default: true
        },

        entries: [
            {


                id: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true
                },
                name: {
                    type: String,
                    default: ""
                },
                profileImg: {
                    type: String,
                    default: ""
                },
                rating: {
                    type: Number,
                    required: true
                },
                comment: {
                    type: String,
                    default: ""
                },
                createdAt: {
                    type: Date,
                    default: Date.now
                },
                replies: [
                    {
                        id: {
                            type: mongoose.Schema.Types.ObjectId,
                            ref: "User"
                        },
                        isAdmin: {
                            type: Boolean,
                            default: false
                        },
                        text: {
                            type: String,
                            default: ""
                        },
                        name: String,
                        email: String,
                        profileImg: String,
                        createdAt: {
                            type: Date,
                            default: Date.now
                        }
                    }
                ]
            }
        ],

        images: {
            type: [String],
            default: []
        }
    },

},
    { timestamps: true })

HousePosts.index({ "user.id": 1, createdAt: -1 });
HousePosts.index({ contentType: 1, createdAt: -1 });
const HouseModel = mongoose.model("houses", HousePosts)

export default HouseModel