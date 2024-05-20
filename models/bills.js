const mongoose = require('mongoose');

const  billsSchema = new mongoose.Schema({
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
    },
    date: {
        type: String,
        default: new Date().toISOString().slice(0, 10)
    },
    units: {
        type: Number
    },
    amount: {
        type: Number,
    },
    status: {
        type: String,
        default: "Due"
    }
}, {timestamps: true});

const Bills = mongoose.model('bill', billsSchema);
module.exports = Bills;