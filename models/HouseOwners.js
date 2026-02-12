import mongoose from "mongoose";

const payment = new mongoose.Schema(
    {
        nkwaTransactionId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
         added:{
    type: String,
        enum: ["added", "notadded"],
       defualt: "notadded"
   },

        internalRef: {
            type: String,
            index: true
        },

        merchantId: {
            type: Number,
            index: true
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
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
);

const HouseOwners = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true
        },

        email: {
            type: String,
            unique: true,
            required: true
        },

        location: {
            type: String,
            default: ""
        },

        password: {
            type: String,
            required: true
        },

        companyname: {
            type: String,
            required: true
        },

        bio: {
            type: String,
            required: true
        },

        phone: {
            type: String,
            unique: true,
            required: true
        },

        interest: {
            type: String,
            required: true
        },

        IDno: {
            type: String,
            required: true
        },

        profile: {
            type: String,
            default: ""
        },

        twofactormethod: {
            type: String,
            enum: ["email", "sms"],
            default: "email"
        },

        enabletwofactor: {
            type: Boolean,
            default: false
        },

        paymentmethod: {
            type: String,
            enum: ["mtnmomo", "orange", "paypal", "creditcard"],
            default: "mtnmomo"
        },

        paymentprscribtion: {
            type: [payment],
            default: []
        },


        Notifications: {
            type: Boolean,
            default: true
        },

        role: {
            type: String,
            enum: ["seeker", "owner"],
            default: "owner"
        },

        totalBalance: {
            type: Number,
            default: 0
        },

        allchatsId: {
            type: Array,
            default: []
        }
    },
    { timestamps: true }
);

const HouseOwerModel = mongoose.model("houseowner", HouseOwners);

payment.post("findOneAndUpdate", async function (doc) {
    if (!doc) return;

    try {
        const update = this.getUpdate();

        const newStatus =
            update?.status ||
            update?.$set?.status;

        // only act if status is being changed to success
        if (newStatus !== "success") return;

        // prevent double increment
        const previousDoc = await this.model.findOne(this.getQuery());
        if (previousDoc?.status === "success") return;

        // increment balance of house owner
        await mongoose.model("houseowner").updateOne(
            { _id: doc.userId },
            { $inc: { totalBalance: doc.amount } }
        );

    } catch (error) {
        console.error("Balance update failed:", error);
    }
});

export default HouseOwerModel;
