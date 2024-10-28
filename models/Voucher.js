const mongoose = require('mongoose');

const VoucherSchema = new mongoose.Schema({
    voucher_id: {
        type: mongoose.Schema.Types.ObjectId,
        default: mongoose.Types.ObjectId,
        primary: true
    },
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
        required: true,
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
    min_order: {
        type: Number,
        required: true,
    },

}, { timestamps: true });

module.exports = mongoose.model('Voucher', VoucherSchema);