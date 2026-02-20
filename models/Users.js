import mongoose from "mongoose";

/* =====================================================
   PAYMENT SUBDOCUMENT (Embedded Inside User)
===================================================== */



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
    phone: {
      type: String,
      unique: true,
      sparse: true, // <-- allows multiple nulls
      trim: true
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


/* =====================================================
   USER SCHEMA
===================================================== */

const userSchema = new mongoose.Schema(
  {

    referalbalance: {
      type: Number,
      default: 0
    },
    accountstatus: {
      type: String, enum: ["suspended", "ban", "active"],
      default: "active"
    },
    reason: {
      type: String
    },
    googleId: { type: String, sparse: true },
    accountstatus: {
      type: String,
      enum: ["active", "suspended", "deactivated", "review", "ban"],
      default: "active"

    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    number: {
      type: String,
      defualt: "",
      unique: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    profile: {
      type: String
    },

    password: {
      type: String
    },

    interest: {
      type: String
    },

    Notifications: {
      type: Boolean,
      default: true
    },

    savedHouses: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "house",
      default: []
    },

    allchatsId: {
      type: [String],
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
      type: [paymentSchema],
      default: []
    },
    paytoviewdetailstartdate: {
      type: Date,
      default: null
    },
    paytoviewenddate: {
      type: Date,
      default: null
    },
    haspay: {
      type: Boolean,
      default: false
    }


  },
  { timestamps: true }
);


/* =====================================================
   MODEL EXPORT
===================================================== */

const UserModel = mongoose.model("user", userSchema);

export default UserModel;
