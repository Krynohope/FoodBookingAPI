const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const { upload } = require('../middlewares/uploadFile');
const {
    getPaymentMethods,
    getPaymentMethodById,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod
} = require('../controllers/payment_methodController');

// Validation middleware
const paymentMethodValidation = [
    check('name', 'Name is required').not().isEmpty(),
    check('type', 'Type is required').not().isEmpty(),
    check('status', 'Status is required').not().isEmpty()
];

// Routes
router.get('/', getPaymentMethods);
router.get('/:id', getPaymentMethodById);
router.post('/',
    upload.single('img'),
    paymentMethodValidation,
    createPaymentMethod
);
router.patch('/:id',
    upload.single('img'),
    updatePaymentMethod
);
router.delete('/:id', deletePaymentMethod);

module.exports = router;