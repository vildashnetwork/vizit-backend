import mongoose, { trusted } from "mongoose";


const payment = new mongoose.Schema({
    paymentamount: {
        type: String,
        default: "0XAF"
    },
    expiringdate: {
        type: String,
        default: ""
    },
    payed: {
        type: Boolean,
        default: false
    },

})


const HouseOwners = new mongoose.Schema({
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
        default: "",
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
        defualt: false
    },
    paymentmethod: {
        type: String,
        enum: ["mtnmomo", "orange", "paypal", "creditcard"],
        defualt: "mtnmomo"
    },
    paymentprscribtion: payment,
    Notifications: {
        type: Boolean,
        default: true
    }

},
    { timestamps: true }
);

const HouseOwerModel = mongoose.model("houseowner", HouseOwners);

export default HouseOwerModel