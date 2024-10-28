const mongoose = require('mongoose');

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
        required: true,
        min: 0,
    },
    image: {
        type: String,
        trim: true,
    },

    variant: {
        type: {
            size: {
                type: String,
                required: true,
                trim: true,
            },
            price: {
                type: Number,
                required: true,
            },
        },
        required: false
    }


}, { timestamps: true });

module.exports = mongoose.model('Menu', MenuSchema);