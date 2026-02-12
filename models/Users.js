import mongoose from "mongoose"




const payment = new mongoose.Schema({

    nkwaTransactionId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    internalRef: {
        type: String,
        index: true
    },
   added:{
    type: String,
        enum: ["added", "notadded"],
    default: "notadded"


   },
    merchantId: {
        type: Number,
        index: true
    },

    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true
    },

    amount: {
        type: Number,
        required: true,
        min: 0
    },

    currency: {
        type: String,
        default: "XAF"
    },

    fee: {
        type: Number,
        default: 0
    },

    merchantPaidFee: {
        type: Boolean,
        default: true
    },

    phoneNumber: {
        type: String,
        required: true,
        index: true
    },

    telecomOperator: {
        type: String,
        enum: ["mtn", "orange"],
        lowercase: true,
        index: true
    },

    status: {
        type: String,
        enum: ["pending", "success", "failed", "canceled"],
        default: "pending",
        index: true
    },

    paymentType: {
        type: String,
        enum: ["collection", "disbursement"],
        required: true
    },

    description: {
        type: String
    },

    failureReason: {
        type: String
    },

    verifiedAt: {
        type: Date
    },

    rawResponse: {
        type: mongoose.Schema.Types.Mixed
    }
},
    {
        timestamps: true
    }
)



const User = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    number: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        default: ""
    },
    profile: {
        type: String,
        default: "" // fixed typo
    },
    password: {
        type: String,
        required: true
    },
    interest: {
        type: String,
        required: true
    },
    Notifications: {
        type: Boolean,
        default: true
    },
    savedHouses: {
        type: Array,
        default: []
    },
    allchatsId: {
        type: Array,
        default: []
    },
    role: {
        type: String,
        enum: ["seeker", "owner"],
        default: "seeker"
    },

    totalBalance: {
        type: Number,
        default: 0
    },

    paymentprscribtion: {
        type: [payment],
        default: []
    },


},
    { timestamps: true }
)



const UserModel = mongoose.model("user", User)







export default UserModel
