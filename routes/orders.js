const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const authMiddleware = require('../middlewares/authMiddleware');
const orderController = require('../controllers/orderController');

// User Routes
router.post('/', authMiddleware(), orderController.createOrder);

// Get user orders with pagination and filters
router.get('/', authMiddleware(), orderController.getUserOrders);

// Get order by ID
router.get('/:id', authMiddleware(), orderController.getOrderById);

// Cancel order (trong 5 phút)
router.post('/:id/cancel', authMiddleware(), orderController.cancelOrder);





module.exports = router;