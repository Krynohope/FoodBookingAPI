const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const authMiddleware = require('../middlewares/authMiddleware');
const orderController = require('../controllers/orderController');

// User Routes
router.post('/', [
    authMiddleware(),
    [
        check('menu_id', 'Menu ID is required').not().isEmpty(),
        check('quantity', 'Quantity must be at least 1').isInt({ min: 1 }),
        check('shipping_address', 'Shipping address is required').not().isEmpty(),
        check('payment_method', 'Payment method is required').isIn(['Thanh toán khi nhận hàng', 'Zalopay'])
    ]
], orderController.createOrder);

// Get user orders with pagination and filters
router.get('/', authMiddleware(), orderController.getUserOrders);

// Get order by ID
router.get('/:id', authMiddleware(), orderController.getOrderById);

// Cancel order (trong 5 phút)
router.post('/:id/cancel', authMiddleware(), orderController.cancelOrder);





module.exports = router;