const { validationResult } = require('express-validator');
const Order = require('../models/Order');
const Menu = require('../models/Menu');
const Voucher = require('../models/Voucher');
const Payment_method = require('../models/Payment_method');
const User = require('../models/User');
const zalopayController = require('./zalopayController')
const dotenv = require('dotenv');
const { request } = require('express');

dotenv.config();



// Create new order
exports.createOrder = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { orderItems, shipping_address, payment_method_id, code } = req.body;

    try {
        // Validate payment method
        const paymentMethod = await Payment_method.findById(payment_method_id);
        if (!paymentMethod) {
            return res.status(404).json({ message: 'Payment method not found' });
        }

        // Validate shipping address structure
        if (!shipping_address || !shipping_address.receiver || !shipping_address.phone || !shipping_address.address) {
            return res.status(400).json({ message: 'Invalid shipping address format' });
        }

        // Validate phone number format
        const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/;
        if (!phoneRegex.test(shipping_address.phone)) {
            return res.status(400).json({ message: 'Invalid phone number format' });
        }

        // Validate order items
        if (!Array.isArray(orderItems) || orderItems.length === 0) {
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
                const selectedVariant = menu.variant.find(v => v.size === item.variant_size);
                if (!selectedVariant) {
                    return res.status(400).json({
                        message: `Invalid variant size "${item.variant_size}" for menu item: ${menu.name}`
                    });
                }
                itemPrice = selectedVariant.price;
            } else {
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
                variant_size: item.variant_size || null,
                rating: null,
                comment: null
            });

            subtotal += itemPrice * item.quantity;
        }

        // Calculate shipping cost
        let shippingCost = 15000; // Default shipping cost
        const totalItems = processedItems.reduce((sum, item) => sum + item.quantity, 0);

        if (totalItems > 6) {
            shippingCost = 0;
        } else if (totalItems > 3) {
            shippingCost = 10000;
        }

        // Process voucher if provided
        let total = subtotal;
        let voucher = null;

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

            const discountAmount = Math.min((subtotal * voucher.discount_percent) / 100, voucher.max_discount || Infinity);
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
            payment_method: payment_method_id,
            payment_status: 'pending',
            ship: shippingCost,
            shipping_address,
            orderDetail: processedItems
        });

        req.order = order
        // Update menu item quantities
        for (const item of processedItems) {
            const menu = await Menu.findById(item.menu_id);
            if (menu.quantity !== undefined) {
                menu.quantity -= item.quantity;
                await menu.save();
            }
        }

        await order.save();
        await order.populate([
            { path: 'orderDetail.menu_id' },
            { path: 'payment_method' },
            { path: 'voucher_id' }
        ]);

        const paymentName = await Payment_method.findById(order.payment_method)

        switch (paymentName.name.toLowerCase()) {
            case 'zalopay':

                const zlpay = await zalopayController.payment(req, res)
                return res.json({ order_url: zlpay.order_url })


            default:
                const response = {
                    message: 'Order placed successfully',
                    order,
                    orderSummary: {
                        subtotal,
                        shippingCost,
                        discount: voucher ? {
                            name: voucher.name,
                            discountPercent: voucher.discount_percent,
                            discountAmount: total - subtotal + shippingCost
                        } : null,
                        total
                    }
                };

                return res.status(201).json(response);
        }


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
            .populate([
                { path: 'orderDetail.menu_id' },
                { path: 'payment_method' },
                { path: 'voucher_id' }
            ])
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
            .populate([
                { path: 'orderDetail.menu_id' },
                { path: 'user_id', select: 'full_name email' },
                { path: 'payment_method' },
                { path: 'voucher_id' }
            ]);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.user_id._id.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access forbidden: Not your order' });
        }

        res.json(order);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Get all orders (Admin only)
exports.getAllOrders = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access forbidden: Admin only' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skipIndex = (page - 1) * limit;

        const { status, payment_method } = req.query;
        let query = {};

        if (status) query.status = status;
        if (payment_method) query.payment_method = payment_method;

        const orders = await Order.find(query)
            .populate([
                { path: 'user_id', select: 'full_name email' },
                { path: 'orderDetail.menu_id' },
                { path: 'payment_method' },
                { path: 'voucher_id' }
            ])
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
            if (order.status === 'cancelled' && status !== 'cancelled') {
                return res.status(400).json({ message: 'Cannot change status of cancelled order' });
            }
            if (order.status === 'completed' && status !== 'completed') {
                return res.status(400).json({ message: 'Cannot change status of completed order' });
            }
            order.status = status;
        }
        if (payment_status) order.payment_status = payment_status;

        await order.save();
        await order.populate([
            { path: 'orderDetail.menu_id' },
            { path: 'payment_method' },
            { path: 'voucher_id' }
        ]);

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

        if (order.status !== 'pending') {
            return res.status(400).json({
                message: 'Order cannot be cancelled. Only pending orders can be cancelled.'
            });
        }

        const timeDifference = (Date.now() - order.createdAt.getTime()) / (1000 * 60);
        if (timeDifference > 5) {
            return res.status(400).json({
                message: 'Order cannot be cancelled. The 5-minute cancellation window has expired.'
            });
        }

        // Restore menu item quantities
        for (const item of order.orderDetail) {
            const menu = await Menu.findById(item.menu_id);
            if (menu && menu.quantity !== undefined) {
                menu.quantity += item.quantity;
                await menu.save();
            }
        }

        order.status = 'cancelled';
        order.payment_status = 'failed';
        await order.save();
        await order.populate([
            { path: 'orderDetail.menu_id' },
            { path: 'payment_method' },
            { path: 'voucher_id' }
        ]);

        res.json({ message: 'Order cancelled successfully', order });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

async function updateMenuStarRating(menuId) {
    try {
        const orders = await Order.find({
            'orderDetail': {
                $elemMatch: {
                    menu_id: menuId,
                    rating: { $ne: null }
                }
            }
        });

        const reviews = orders.flatMap(order =>
            order.orderDetail.filter(item =>
                item.menu_id.toString() === menuId.toString() &&
                item.rating !== null
            )
        );

        const averageRating = reviews.length > 0
            ? (reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length)
            : 0;

        await Menu.findByIdAndUpdate(menuId, {
            star: Number(averageRating.toFixed(1))
        });

        return averageRating;
    } catch (error) {
        console.error('Error updating menu star rating:', error);
        throw error;
    }
}

//Review
// Post review for ordered item
exports.postReview = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { order_id, menu_id, rating, comment } = req.body;

        // Validate rating
        if (rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        // Find the order
        const order = await Order.findOne({ order_id });
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Verify order belongs to user
        if (order.user_id.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Access forbidden: Not your order' });
        }

        // Verify order is completed
        if (order.status !== 'completed') {
            return res.status(400).json({ message: 'Can only review completed orders' });
        }

        // Find the specific item in the order
        const orderItem = order.orderDetail.find(
            item => item.menu_id.toString() === menu_id
        );

        if (!orderItem) {
            return res.status(404).json({ message: 'Item not found in this order' });
        }

        // Check if item has already been reviewed
        if (orderItem.rating !== null) {
            return res.status(400).json({ message: 'Item has already been reviewed' });
        }

        // Update the review
        orderItem.rating = rating;
        orderItem.comment = comment || '';

        await order.save();

        // Update menu star rating
        const averageRating = await updateMenuStarRating(menu_id);

        // Populate necessary fields for response
        await order.populate([
            { path: 'orderDetail.menu_id' },
            { path: 'user_id', select: 'full_name email' }
        ]);

        res.json({
            message: 'Review posted successfully',
            review: {
                order_id: order.order_id,
                menu_item: orderItem.menu_id,
                rating: orderItem.rating,
                comment: orderItem.comment,
                user: order.user_id,
                created_at: order.updatedAt
            },
            menu_average_rating: averageRating
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// Get reviews by menu item ID
exports.getMenuReviews = async (req, res) => {
    try {
        const { menu_id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skipIndex = (page - 1) * limit;

        // Get menu details including star rating
        const menu = await Menu.findById(menu_id).select('name star');
        if (!menu) {
            return res.status(404).json({ message: 'Menu item not found' });
        }

        // Find all orders containing reviews for this menu item
        const orders = await Order.find({
            'orderDetail': {
                $elemMatch: {
                    menu_id: menu_id,
                    rating: { $ne: null }
                }
            }
        })
            .populate([
                { path: 'orderDetail.menu_id' },
                { path: 'user_id', select: 'full_name email' }
            ])
            .sort({ updatedAt: -1 })
            .skip(skipIndex)
            .limit(limit);

        // Extract and format reviews
        const reviews = orders.flatMap(order =>
            order.orderDetail
                .filter(item =>
                    item.menu_id._id.toString() === menu_id &&
                    item.rating !== null
                )
                .map(item => ({
                    order_id: order.order_id,
                    menu_item: item.menu_id,
                    rating: item.rating,
                    comment: item.comment,
                    user: order.user_id,
                    created_at: order.updatedAt
                }))
        );

        // Get total count for pagination
        const totalReviews = await Order.countDocuments({
            'orderDetail': {
                $elemMatch: {
                    menu_id: menu_id,
                    rating: { $ne: null }
                }
            }
        });

        res.json({
            menu_id,
            menu_name: menu.name,
            average_rating: menu.star || 0,
            total_reviews: totalReviews,
            current_page: page,
            total_pages: Math.ceil(totalReviews / limit),
            reviews
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// Get all reviews (Admin only)
exports.getAllReviews = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access forbidden: Admin only' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skipIndex = (page - 1) * limit;

        // Build filter query
        const {
            menu_id,
            rating,
            start_date,
            end_date,
            has_comment,
            min_rating,
            max_rating
        } = req.query;

        let matchQuery = {
            'orderDetail.rating': { $ne: null }
        };

        if (menu_id) {
            matchQuery['orderDetail.menu_id'] = mongoose.Types.ObjectId(menu_id);
        }

        if (rating) {
            matchQuery['orderDetail.rating'] = parseInt(rating);
        } else if (min_rating || max_rating) {
            matchQuery['orderDetail.rating'] = {};
            if (min_rating) matchQuery['orderDetail.rating'].$gte = parseInt(min_rating);
            if (max_rating) matchQuery['orderDetail.rating'].$lte = parseInt(max_rating);
        }

        if (start_date || end_date) {
            matchQuery.updatedAt = {};
            if (start_date) matchQuery.updatedAt.$gte = new Date(start_date);
            if (end_date) matchQuery.updatedAt.$lte = new Date(end_date);
        }

        if (has_comment === 'true') {
            matchQuery['orderDetail.comment'] = { $ne: null, $ne: '' };
        }

        const orders = await Order.find(matchQuery)
            .populate([
                { path: 'orderDetail.menu_id' },
                { path: 'user_id', select: 'full_name email' }
            ])
            .sort({ updatedAt: -1 })
            .skip(skipIndex)
            .limit(limit);

        // Extract and format reviews
        const reviews = orders.flatMap(order =>
            order.orderDetail
                .filter(item => item.rating !== null)
                .map(item => ({
                    order_id: order.order_id,
                    menu_item: item.menu_id,
                    rating: item.rating,
                    comment: item.comment,
                    user: order.user_id,
                    created_at: order.updatedAt
                }))
        );

        // Get total count for pagination
        const totalCount = await Order.countDocuments(matchQuery);

        res.json({
            total_reviews: totalCount,
            current_page: page,
            total_pages: Math.ceil(totalCount / limit),
            reviews
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};