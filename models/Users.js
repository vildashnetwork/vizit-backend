import mongoose from "mongoose"

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
        default: "",
        // unique: true
    },
    profile: {
        type: String,
        defualt: ""
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
    }

},
    { timestamps: true }
)

const UserModel = mongoose.model("user", User)

export default UserModel