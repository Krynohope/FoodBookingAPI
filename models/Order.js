const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        default: mongoose.Types.ObjectId,
        primary: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        required: true,
        trim: true,
    },
    total: {
        type: Number,
        required: true,
    },

    payment_method: {
        type: String,
        required: true,
        trim: true,
    },
    payment_status: {
        type: String,
        required: true,
        trim: true,
    },

    shipping_address: {
        type: String,
        required: true,
        trim: true,
    },

    orderDetail: {
        menu_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Menu',
            required: true,
        },
        quantity: {
            type: Number,
            required: true,
        },
        price: {
            type: Number,
            required: true,
        },
    },

}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);