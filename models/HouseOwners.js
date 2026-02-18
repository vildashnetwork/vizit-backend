import mongoose from "mongoose";

/* =========================
   PAYMENT SUB-SCHEMA
========================= */

const paymentSchema = new mongoose.Schema(
  {
    nkwaTransactionId: {
      type: String,
      unique: true, // Add this
      sparse: true, // Keep this
      default: undefined // Best practice for sparse unique indexes in arrays
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


/* =========================
   HOUSE OWNER SCHEMA
========================= */

const houseOwnerSchema = new mongoose.Schema(
  {

    accountstatus: {
      type: String, enum: ["suspended", "ban", "active"],
      default: "active"
    },
    reason: {
      type: String
    },


    googleId: { type: String, sparse: true },



    companyEmail: { type: String },
    idSnapshot: { type: String },
    taxCardSnapshot: { type: String },
    selfieWithId: { type: String },
    status: {
      type: String, enum: ["pending", "approved", "rejected"],
      default: "pending"
    },



    name: {
      type: String,
      required: true,
      trim: true

    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },

    location: {
      type: String
    },

    password: {
      type: String,
    },

    companyName: {
      type: String
    },

    bio: {
      type: String
    },

    phone: {
      type: String
    },

    interest: {
      type: String
    },

    IDno: {
      type: String
    },

    profile: {
      type: String
    },

    twoFactorMethod: {
      type: String,
      enum: ["email", "sms"],
      default: "email"
    },

    enableTwoFactor: {
      type: Boolean,
      default: false
    },

    paymentMethod: {
      type: String,
      enum: ["mtnmomo", "orange", "paypal", "creditcard"],
      default: "mtnmomo"
    },

    paymentprscribtion: {
      type: [paymentSchema],
      default: []
    },

    notifications: {
      type: Boolean,
      default: true
    },

    role: {
      type: String,
      enum: ["owner"],
      default: "owner"
    },

    totalBalance: {
      type: Number,
      default: 0
    },

    allChatsId: {
      type: Array,
      default: []
    },

    /* =========================
       VERIFICATION SYSTEM
    ========================= */

    verified: {
      type: Boolean,
      default: false
    },

    verificationBalance: {
      type: Number,
      default: 0
    },

    dateOfVerification: {
      type: Date,
      default: null
    },

    verificationExpiryDate: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);


/* =========================
   MODEL EXPORT
========================= */

const HouseOwnerModel = mongoose.model("houseowner", houseOwnerSchema);

export default HouseOwnerModel;
