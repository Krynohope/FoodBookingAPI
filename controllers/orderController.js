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

        const order = new Order({
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
        const orders = await Order.find({ user_id: req.user.id })
            .populate('orderDetail.menu_id')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Get order by ID
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('orderDetail.menu_id');

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

        const orders = await Order.find()
            .populate('user_id', 'full_name email')
            .populate('orderDetail.menu_id')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skipIndex);

        const total = await Order.countDocuments();

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
        const order = await Order.findById(req.params.id);

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

// Cancel order (User)
exports.cancelOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.user_id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access forbidden: Not your order' });
        }

        // Only allow cancellation if order is in pending status
        if (order.status !== 'pending') {
            return res.status(400).json({
                message: 'Order cannot be cancelled. Only pending orders can be cancelled.'
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

        const stats = await Order.aggregate([
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$total' },
                    averageOrderValue: { $avg: '$total' },
                    pendingOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
                        }
                    },
                    completedOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
                        }
                    },
                    cancelledOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
                        }
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
            cancelledOrders: 0
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};