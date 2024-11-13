const mongoose = require('mongoose');
require('./User')
require('./Order')

const Payment_methodSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        required: true
    },
    type: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    status: {
        type: String,
        trim: true,
    },
    img: {
        type: String,
        trim: true,
    }

}, { timestamps: true });

module.exports = mongoose.model('Payment_method', Payment_methodSchema);