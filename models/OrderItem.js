const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
    },
    dish: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Dish',
        required: true,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1,
    },
    price: {
        type: mongoose.Decimal128,
        required: true,
        get: getDecimal,
        set: setDecimal,
    },
}, { timestamps: true });

function getDecimal(value) {
    return parseFloat(value.toString());
}

function setDecimal(value) {
    return mongoose.Types.Decimal128.fromString(value.toString());
}

module.exports = mongoose.model('OrderItem', OrderItemSchema);
