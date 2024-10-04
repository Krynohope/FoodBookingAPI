const mongoose = require('mongoose');

const DishSchema = new mongoose.Schema({
    menu: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Menu',
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
        type: mongoose.Decimal128,
        required: true,
        get: getDecimal,
        set: setDecimal,
    },
    image_url: {
        type: String,
        trim: true,
    },
}, { timestamps: true });

function getDecimal(value) {
    return parseFloat(value.toString());
}

function setDecimal(value) {
    return mongoose.Types.Decimal128.fromString(value.toString());
}

module.exports = mongoose.model('Dish', DishSchema);
