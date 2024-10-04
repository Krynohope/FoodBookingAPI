const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    total_price: {
        type: mongoose.Decimal128,
        required: true,
        get: getDecimal,
        set: setDecimal,
    },
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Completed', 'Canceled'],
        default: 'Pending',
    },
    payment_method: {
        type: String,
        enum: ['Cash', 'Credit Card', 'E-Wallet'],
        default: 'Cash',
    },
    shipping_address: {
        type: String,
        required: true,
        trim: true,
    },
}, { timestamps: true });

function getDecimal(value) {
    return parseFloat(value.toString());
}

function setDecimal(value) {
    return mongoose.Types.Decimal128.fromString(value.toString());
}

module.exports = mongoose.model('Order', OrderSchema);
