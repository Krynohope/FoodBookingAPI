const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema({

    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
    },
    rating: {
        type: Number,
        required: true,
    },
    comment: {
        type: String,
        trim: true,
    }

}, { timestamps: true });

module.exports = mongoose.model('Review', ReviewSchema);