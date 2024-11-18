const express = require('express');
const router = express.Router();

const {
    getPaymentMethods,
    getPaymentMethodById,

} = require('../controllers/payment_methodController');



// Routes
router.get('/', getPaymentMethods);
router.get('/:id', getPaymentMethodById);


module.exports = router;