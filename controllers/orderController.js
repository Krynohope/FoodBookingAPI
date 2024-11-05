const { validationResult } = require('express-validator');
const Order = require('../models/Order');
const Menu = require('../models/Menu');
const Voucher = require('../models/Voucher');


// Create new order
exports.createOrder = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { orderItems, shipping_address, payment_method, code } = req.body;

    try {
        // Validate order items
        if (!Array.isArray(orderItems) || orderItems.length === 0) {
            return res.status(400).json({ message: 'Order items must be a non-empty array' });
        }

        // Process all menu items and calculate initial total
        const processedItems = [];
        let subtotal = 0;

        for (const item of orderItems) {
            const menu = await Menu.findById(item.menu_id);
            if (!menu) {
                return res.status(404).json({
                    message: `Menu item not found with ID: ${item.menu_id}`
                });
            }

            processedItems.push({
                menu_id: menu._id,
                quantity: item.quantity,
                price: menu.price
            });

            subtotal += parseFloat(menu.price) * item.quantity;
        }

        // Process voucher if provided
        let total = subtotal;
        let voucher = null;
        let discountAmount = 0;

        if (code) {
            voucher = await Voucher.findOne({
                code,
                start: { $lte: new Date() },
                end: { $gte: new Date() }
            });

            if (!voucher) {
                return res.status(400).json({ message: 'Invalid or expired voucher code' });
            }

            // Check minimum order amount
            if (subtotal < voucher.min_price) {
                return res.status(400).json({
                    message: `Order total must be at least ${voucher.min_price} to use this voucher`
                });
            }

            // Check if voucher limit is reached
            const voucherUsageCount = await Order.countDocuments({
                voucher_id: voucher._id,
                status: { $ne: 'cancelled' }
            });

            if (voucherUsageCount >= voucher.limit) {
                return res.status(400).json({ message: 'Voucher usage limit reached' });
            }

            // Apply discount
            discountAmount = (subtotal * voucher.discount_percent) / 100;
            total = subtotal - discountAmount;
        }

        const orderNumber = Date.now().toString(); // Simple order ID generation

        const order = new Order({
            order_id: orderNumber,
            user_id: req.user.id,
            voucher_id: voucher ? voucher._id : null,
            status: 'pending',
            total,
            payment_method,
            payment_status: 'pending',
            shipping_address,
            orderDetail: processedItems
        });

        await order.save();

        // Populate menu details for response
        await order.populate('orderDetail.menu_id');

        res.status(201).json({
            message: 'Order placed successfully',
            order,
            orderSummary: {
                subtotal,
                discount: voucher ? {
                    name: voucher.name,
                    discountPercent: voucher.discount_percent,
                    discountAmount
                } : null,
                total
            }
        });
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