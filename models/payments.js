const mongoose = require('mongoose');

const paymentsSchema = new mongoose.Schema({
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users'
    },
    billNo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'bill'
    },
    amount: {
        type: Number,
        require: true
    },
    method: {
        type: String,
        default: 'Offline'
    }
}, {timestamps: true});

const Payments = mongoose.model('payments', paymentsSchema);
module.exports = Payments;