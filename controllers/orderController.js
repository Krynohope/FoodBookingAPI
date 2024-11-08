const { validationResult } = require('express-validator');
const Order = require('../models/Order');
const Menu = require('../models/Menu');
const Voucher = require('../models/Voucher');
const User = require('../models/User');
const dotenv = require('dotenv');
const { log } = require('debug/src/browser');
dotenv.config();



// Create new order
exports.createOrder = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { orderItems, shipping_address, payment_method, code } = req.body;

    try {
        // Validate order items
        if (!Array.isArray(orderItems) || orderItems.length == 0) {
            return res.status(400).json({ message: 'Order items must be a non-empty array' });
        }

        // Process all menu items and calculate initial total
        const processedItems = [];
        let subtotal = 0;

        for (const item of orderItems) {
            if (!item.menu_id || !item.quantity || item.quantity < 1) {
                return res.status(400).json({
                    message: 'Each order item must have a menu_id and valid quantity'
                });
            }

            const menu = await Menu.findById(item.menu_id);
            if (!menu) {
                return res.status(404).json({
                    message: `Menu item not found with ID: ${item.menu_id}`
                });
            }

            // Handle items with variants
            let itemPrice;
            if (item.variant_size && menu.variant && menu.variant.length > 0) {
                const selectedVariant = menu.variant.find(v => v.size == item.variant_size);
                if (!selectedVariant) {
                    return res.status(400).json({
                        message: `Invalid variant size "${item.variant_size}" for menu item: ${menu.name}`
                    });
                }
                itemPrice = selectedVariant.price;
            } else {
                // Regular menu item without variant
                if (!menu.price) {
                    return res.status(400).json({
                        message: `Price not set for menu item: ${menu.name}`
                    });
                }
                itemPrice = menu.price;
            }

            // Check if quantity is available
            if (menu.quantity !== undefined && menu.quantity < item.quantity) {
                return res.status(400).json({
                    message: `Insufficient quantity available for ${menu.name}. Available: ${menu.quantity}`
                });
            }

            processedItems.push({
                menu_id: menu._id,
                quantity: item.quantity,
                price: itemPrice,
                variant_size: item.variant_size || null
            });

            subtotal += itemPrice * item.quantity;
        }

        // Calculate shipping cost
        let shippingCost = 30000; // Default shipping cost
        const totalItems = processedItems.reduce((sum, item) => sum + item.quantity, 0);

        if (totalItems > 6) {
            shippingCost = 0;
        } else if (totalItems > 3) {
            shippingCost = 15000;
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

            if (subtotal < voucher.min_price) {
                return res.status(400).json({
                    message: `Order total must be at least ${voucher.min_price} to use this voucher`
                });
            }

            const voucherUsageCount = await Order.countDocuments({
                voucher_id: voucher._id,
                status: { $ne: 'cancelled' }
            });

            if (voucherUsageCount >= voucher.limit) {
                return res.status(400).json({ message: 'Voucher usage limit reached' });
            }

            discountAmount = Math.min((subtotal * voucher.discount_percent) / 100, voucher.max_discount || Infinity);
            total = subtotal - discountAmount;
        }

        total += shippingCost;

        // Generate order ID
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const emailFirstChar = user.email.charAt(0).toUpperCase();
        const currentDate = new Date();
        const formattedDate = `${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, '0')}${String(currentDate.getDate()).padStart(2, '0')}`;
        const timeStamp = `${String(currentDate.getHours()).padStart(2, '0')}${String(currentDate.getMinutes()).padStart(2, '0')}${String(currentDate.getSeconds()).padStart(2, '0')}`;
        const orderNumber = `${emailFirstChar}${formattedDate}${timeStamp}`;

        const order = new Order({
            order_id: orderNumber,
            user_id: req.user.id,
            voucher_id: voucher ? voucher._id : null,
            status: 'pending',
            total,
            payment_method,
            payment_status: 'pending',
            shipping_address,
            ship: shippingCost,
            orderDetail: processedItems
        });

        // Update menu item quantities
        for (const item of processedItems) {
            const menu = await Menu.findById(item.menu_id);
            if (menu.quantity != undefined) {
                menu.quantity -= item.quantity;
                await menu.save();
            }
        }

        await order.save();
        await order.populate('orderDetail.menu_id');

        const response = {
            message: 'Order placed successfully',
            order,
            orderSummary: {
                subtotal,
                shippingCost,
                discount: voucher ? {
                    name: voucher.name,
                    discountPercent: voucher.discount_percent,
                    discountAmount
                } : null,
                total
            }
        };

        if (payment_method == 'zalopay') {
            //

        }

        return res.status(201).json(response);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};


// Get user's orders
exports.getUserOrders = async (req, res) => {
    try {
        const { status, payment_method, payment_status, page = 1, limit = 10 } = req.query;
        const skipIndex = (parseInt(page) - 1) * parseInt(limit);

        let query = { user_id: req.user.id };
        if (status) query.status = status;
        if (payment_method) query.payment_method = payment_method;
        if (payment_status) query.payment_status = payment_status;

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
            .populate('user_id', 'full_name email')
            .populate('voucher_id');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.user_id._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access forbidden: Not your order' });
        }

        res.json({
            ...order.toObject(),
            payment_status: order.payment_status
        });
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

        if (status) {
            // Prevent invalid status transitions
            if (order.status == 'cancelled' && status != 'cancelled') {
                return res.status(400).json({ message: 'Cannot change status of cancelled order' });
            }
            if (order.status == 'completed' && status != 'completed') {
                return res.status(400).json({ message: 'Cannot change status of completed order' });
            }
            order.status = status;
        }
        if (payment_status) order.payment_status = payment_status;

        await order.save();

        res.json({ message: 'Order status updated successfully', order });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Cancel order (within 5 minutes)
exports.cancleOrder = async (req, res) => {
    try {
        const order = await Order.findOne({ order_id: req.params.id });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.user_id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access forbidden: Not your order' });
        }

        // Check if order status is pending
        if (order.status != 'pending') {
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
        order.payment_method = 'failed';
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