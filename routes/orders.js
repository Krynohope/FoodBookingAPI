const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const orderController = require('../controllers/orderController');
const { check } = require('express-validator');

// User Routes
router.post('/', authMiddleware(), orderController.createOrder);

// Get user orders with pagination and filters
router.get('/', authMiddleware(), orderController.getUserOrders);

// Get order by ID
router.get('/:id', authMiddleware(), orderController.getOrderById);

// Cancel order (trong 5 phút)
router.post('/:id/cancle', authMiddleware(), orderController.cancelOrder);

router.post('/review', [
    check('order_id').notEmpty(),
    check('menu_id').notEmpty(),
    check('rating').isInt({ min: 1, max: 5 }),
], authMiddleware(), orderController.postReview);

router.get('/reviews/menu/:menu_id', orderController.getMenuReviews);

router.get('/reviews', authMiddleware('admin'), orderController.getAllReviews);



module.exports = router;