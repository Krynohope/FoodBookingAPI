const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const orderController = require('../controllers/orderController');
const { check } = require('express-validator');
router.use(authMiddleware());

// User Routes
router.post('/', orderController.createOrder);

// Get user orders with pagination and filters
router.get('/', orderController.getUserOrders);

// Get order by ID
router.get('/:id', orderController.getOrderById);

// Cancel order 
router.post('/:id/cancel', orderController.cancelOrder);

router.post('/review', [
    check('order_id').notEmpty(),
    check('menu_id').notEmpty(),
    check('rating').isInt({ min: 1, max: 5 }),
], orderController.postReview);

router.get('/reviews/menu/:menu_id', orderController.getMenuReviews);





module.exports = router;