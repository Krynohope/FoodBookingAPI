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
    app_trans_id: {
        type: String,
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
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment_method',
        required: true,
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
        receiver: {
            type: String,
            required: true,
            trim: true,
        },
        phone: {
            type: String,
            required: true,
            trim: true,
            match: [/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/, 'Please fill a valid phone number']
        },
        address: {
            type: String,
            required: true,
            trim: true,
        }
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
        },
        rating: {
            default: null,
            type: Number,
            required: false,
        },
        comment: {
            default: null,
            type: String,
            required: false,
        }
    }]

}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);