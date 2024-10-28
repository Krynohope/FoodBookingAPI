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
        check('payment_method', 'Payment method is required').isIn(['Cash', 'Credit Card', 'E-Wallet'])
    ]
], orderController.createOrder);

router.get('/', authMiddleware(), orderController.getUserOrders);

router.get('/:id', authMiddleware(), orderController.getOrderById);

router.post('/:id/cancel', authMiddleware(), orderController.cancelOrder);

// Admin Routes
router.get('/admin/all', [authMiddleware('admin')], orderController.getAllOrders);

router.patch('/admin/:id/status', [
    authMiddleware('admin'),
    [
        check('status').optional().isIn(['pending', 'processing', 'completed', 'cancelled']),
        check('payment_status').optional().isIn(['pending', 'paid', 'failed', 'refunded'])
    ]
], orderController.updateOrderStatus);

router.get('/admin/stats', [authMiddleware('admin')], orderController.getOrderStats);

module.exports = router;