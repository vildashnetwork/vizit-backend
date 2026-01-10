import mongoose from "mongoose"



const apoitmentSchema = new mongoose.Schema({
    listingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "houses",
        required: true
    },

    contact: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["cancelled", "void", "confirmed"],
        default: "void"
    },
    ownerID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "houseowner",
        required: true
    },
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: true
    },
    date: {
        type: String,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        default: ""
    }

},
    { timestamps: true });

const Apoitment = mongoose.model("apoitments", apoitmentSchema);

export default Apoitment;