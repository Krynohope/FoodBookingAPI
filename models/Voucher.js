const mongoose = require('mongoose');

const VoucherSchema = new mongoose.Schema({

    discount_percent: {
        type: Number,
        required: true,
    },
    start: {
        type: Date,
        required: true,
    },
    end: {
        type: Date,
        required: true,
    },
    code: {
        type: String,
        unique: true,
        trim: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    limit: {
        type: Number,
        required: true,
    },
    min_price: {
        type: Number,
        required: true,
    },
    img: {
        type: String,
        trim: true,
    },

}, { timestamps: true });

module.exports = mongoose.model('Voucher', VoucherSchema);