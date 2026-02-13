import mongoose from "mongoose";
const paymentSchema = new mongoose.Schema(
  {
    nkwaTransactionId: {
      type: String,
      unique: true,
      sparse: true // prevents index conflict if undefined
    },

    internalRef: {
      type: String
    },

    added: {
      type: String,
      enum: ["added", "notadded"],
      default: "notadded"
    },

    merchantId: {
      type: Number
    },

    amount: {
      type: Number,
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
      type: String
    },

    telecomOperator: {
      type: String,
      enum: ["mtn", "orange"],
      lowercase: true
    },

    status: {
      type: String,
      enum: ["pending", "success", "failed", "canceled"],
      default: "pending"
    },

    paymentType: {
      type: String,
      enum: ["collection", "disbursement"]
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
  { timestamps: true }
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
      type: [paymentSchema],
      default: []
    }


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
        },

        //  verification
verified: {
    type: Boolean,
    default: false
},
verificationbalance: {
    type: Number,
    default: 0
},
dateofverification: {
    type: Date,
    default: null
},
verificationexpirydate: {
    type: Date,
    default: null
}

    },
    { timestamps: true }
);

const HouseOwerModel = mongoose.model("houseowner", HouseOwners);


export default HouseOwerModel;
