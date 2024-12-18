const mongoose = require('mongoose');
require('./Category')

const MenuSchema = new mongoose.Schema({
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    price: {
        type: Number,
        min: 0,
        trim: true,
    },
    img: {
        type: String,
        trim: true,
    },
    quantity: {
        type: Number,
        trim: true,
    },
    star: {
        type: Number,
        required: false,
    },
    variant: [{
        type: {
            size: {
                type: String,
                trim: true,
            },
            price: {
                type: Number,
                trim: true,
            },
        },
        required: false
    }]


}, { timestamps: true });



module.exports = mongoose.model('Menu', MenuSchema);