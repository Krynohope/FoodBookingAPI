const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const authMiddleware = require('../middlewares/authMiddleware');
const {
    createOrder,
    getUserOrders,
    getOrderById
} = require('../controllers/orderController');



// Protected Routes: Chỉ authenticated users có thể đặt và xem đơn hàng của mình
router.post('/', [authMiddleware(), [
    check('dishes', 'Dishes are required').isArray({ min: 1 }),
    check('dishes.*.dish_id', 'Dish ID is required').not().isEmpty(),
    check('dishes.*.quantity', 'Quantity must be at least 1').isInt({ min: 1 }),
    check('shipping_address', 'Shipping address is required').not().isEmpty(),
    check('payment_method', 'Payment method is required').isIn(['Cash', 'Credit Card', 'E-Wallet']),
]], createOrder);

router.get('/', authMiddleware(), getUserOrders);

router.get('/:id', authMiddleware(), getOrderById);

module.exports = router;
