const { validationResult } = require('express-validator');
const Order = require('../models/Order');
const Menu = require('../models/Menu');

// Create new order
exports.createOrder = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { menu_id, quantity, shipping_address, payment_method } = req.body;

    try {
        const menu = await Menu.findById(menu_id);
        if (!menu) {
            return res.status(404).json({ message: 'Menu item not found' });
        }

        const total = parseFloat(menu.price) * quantity;
        const orderNumber = Date.now().toString(); // Simple order ID generation

        const order = new Order({
            order_id: orderNumber,
            user_id: req.user.id,
            status: 'pending',
            total,
            payment_method,
            payment_status: 'pending',
            shipping_address,
            orderDetail: {
                menu_id,
                quantity,
                price: menu.price
            }
        });

        await order.save();

        res.status(201).json({ message: 'Order placed successfully', order });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Get user's orders
exports.getUserOrders = async (req, res) => {
    try {
        const { status, payment_method, page = 1, limit = 10 } = req.query;
        const skipIndex = (parseInt(page) - 1) * parseInt(limit);

        let query = { user_id: req.user.id };
        if (status) query.status = status;
        if (payment_method) query.payment_method = payment_method;

        const orders = await Order.find(query)
            .populate('orderDetail.menu_id')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(skipIndex);

        const total = await Order.countDocuments(query);

        res.json({
            orders,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalOrders: total
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findOne({ order_id: req.params.id })
            .populate('orderDetail.menu_id')
            .populate('user_id', 'full_name email');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.user_id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access forbidden: Not your order' });
        }

        res.json(order);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Get all orders with pagination (Admin only)
exports.getAllOrders = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access forbidden: Admin only' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skipIndex = (page - 1) * limit;

        // Build query based on filters
        const { status, payment_method } = req.query;
        let query = {};

        if (status) query.status = status;
        if (payment_method) query.payment_method = payment_method;

        const orders = await Order.find(query)
            .populate('user_id', 'full_name email')
            .populate('orderDetail.menu_id')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skipIndex);

        const total = await Order.countDocuments(query);

        res.json({
            orders,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalOrders: total
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Update order status (Admin only)
exports.updateOrderStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access forbidden: Admin only' });
        }

        const { status, payment_status } = req.body;
        const order = await Order.findOne({ order_id: req.params.id });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (status) order.status = status;
        if (payment_status) order.payment_status = payment_status;

        await order.save();

        res.json({ message: 'Order status updated successfully', order });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Cancel order (within 5 minutes)
exports.cancelOrder = async (req, res) => {
    try {
        const order = await Order.findOne({ order_id: req.params.id });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.user_id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access forbidden: Not your order' });
        }

        // Check if order status is pending
        if (order.status !== 'pending') {
            return res.status(400).json({
                message: 'Order cannot be cancelled. Only pending orders can be cancelled.'
            });
        }

        // Check if within 5 minutes
        const timeDifference = (Date.now() - order.createdAt.getTime()) / (1000 * 60);
        if (timeDifference > 5) {
            return res.status(400).json({
                message: 'Order cannot be cancelled. The 5-minute cancellation window has expired.'
            });
        }

        order.status = 'cancelled';
        await order.save();

        res.json({ message: 'Order cancelled successfully', order });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Get order statistics (Admin only)
exports.getOrderStats = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access forbidden: Admin only' });
        }

        const { startDate, endDate } = req.query;
        let dateQuery = {};

        if (startDate && endDate) {
            dateQuery.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const stats = await Order.aggregate([
            {
                $match: dateQuery
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$total' },
                    averageOrderValue: { $avg: '$total' },
                    pendingOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                    },
                    completedOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    cancelledOrders: {
                        $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
                    },
                    zalopayOrders: {
                        $sum: { $cond: [{ $eq: ['$payment_method', 'Zalopay'] }, 1, 0] }
                    },
                    codOrders: {
                        $sum: { $cond: [{ $eq: ['$payment_method', 'Thanh toán khi nhận hàng'] }, 1, 0] }
                    }
                }
            }
        ]);

        res.json(stats[0] || {
            totalOrders: 0,
            totalRevenue: 0,
            averageOrderValue: 0,
            pendingOrders: 0,
            completedOrders: 0,
            cancelledOrders: 0,
            zalopayOrders: 0,
            codOrders: 0
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};