const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    customerName: {
        type: String,
        require: true,
    },
    email: {
        type: String,
        require: true,
        unique: true,
    },
    password: {
        type: String,
        require: true,
    },
    phoneNo: {
        type: String,
    },
    address: {
        type: Object,
        default: {},
        houseNo: {
            type: String,
        },
        street: {
            type: String
        },
        city: {
            type: String
        },
        district: {
            type: String
        },
        country: {
            type: String
        },
        pincode: {
            type: String
        },
    },
    connectionType: {
        type: String,
        default: "domestic",
    },
    isAdmin: {
        type: Boolean,
        default: false
    }
}, {
    strict: false,
    minimize: false,
    timestamps: true });

const Users = mongoose.model('user', userSchema);
module.exports = Users;