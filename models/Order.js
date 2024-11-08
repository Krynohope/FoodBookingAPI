const mongoose = require('mongoose');
require('./User')
require('./Menu')
require('./Voucher')

const OrderSchema = new mongoose.Schema({
    order_id: {
        type: String,
        required: true,
        primary: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    voucher_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Voucher',
        required: false,
        default: null
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
    ship: {
        type: Number,
        required: true,
        trim: true,
    },
    shipping_address: {
        type: String,
        required: true,
        trim: true,
    },

    orderDetail: [{

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
        variant_size: {
            type: String,
            required: false,
            default: null
        }
    }]

}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);