const { validationResult } = require('express-validator');
const Order = require('../models/Order');
const User = require('../models/User');
const Menu = require('../models/Menu');
const Voucher = require('../models/Voucher');
const Payment_method = require('../models/Payment_method');
const zalopayController = require('./zalopayController')
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');


dotenv.config();

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendNoti = (email, order) => {
    const itemsHtml = order.orderDetail.map(item => `
        <tr>
            <td>${item.menu_id}</td>
            <td>${item.quantity}</td>
            <td>${item.price.toLocaleString('vi-VN')} VND</td>
            <td>${item.variant_size || 'Không có'}</td>
        </tr>
    `).join('');

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: `Thông báo xác nhận đơn hàng: ${order.order_id}`,
        html: `
            <h1>Cảm ơn bạn đã đặt hàng tại cửa hàng của chúng tôi!</h1>
            <p>Đơn hàng của bạn đã được cập nhật trạng thái: <b>${order.status}</b>.</p>
            <p>Chi tiết đơn hàng:</p>
            <table border="1" style="border-collapse: collapse; width: 100%;">
                <thead>
                    <tr>
                        <th>Sản phẩm</th>
                        <th>Số lượng</th>
                        <th>Giá</th>
                        <th>Kích cỡ</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            <p><b>Tổng tiền:</b> ${order.total.toLocaleString('vi-VN')} VND</p>
            <p><b>Phí giao hàng:</b> ${order.ship.toLocaleString('vi-VN')} VND</p>
            <p><b>Địa chỉ giao hàng:</b></p>
            <p>${order.shipping_address.receiver} - ${order.shipping_address.phone}</p>
            <p>${order.shipping_address.address}</p>
            <p>Cảm ơn bạn đã tin tưởng và ủng hộ chúng tôi!</p>
        `,
    };

    return transporter.sendMail(mailOptions);
};



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
        const response = {
            message: 'Order placed successfully',
            order,
            order_url: '',
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

        switch (paymentName.name.toLowerCase()) {
            case 'zalopay':

                const zlpay = await zalopayController.payment(req, res)
                response.order_url = zlpay.order_url
                return res.status(201).json(response);


            default:

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
                { path: 'user_id', select: 'fullname email' },
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
        const { search } = req.query;

        const lookupStages = [
            {
                $lookup: {
                    from: 'payment_methods',
                    localField: 'payment_method',
                    foreignField: '_id',
                    as: 'payment_method'
                }
            },
            {
                $lookup: {
                    from: 'menus',
                    localField: 'orderDetail.menu_id',
                    foreignField: '_id',
                    as: 'menu'
                }
            },
            {
                $lookup: {
                    from: 'vouchers',
                    localField: 'voucher_id',
                    foreignField: '_id',
                    as: 'voucher'
                }
            }
        ];

        const searchMatchStage = search ? {
            $match: {
                $or: [
                    { order_id: { $regex: new RegExp(search, 'i') } },
                    { status: { $regex: new RegExp(search, 'i') } },
                    { payment_status: { $regex: new RegExp(search, 'i') } },
                    { app_trans_id: { $regex: new RegExp(search, 'i') } },
                    { 'shipping_address.receiver': { $regex: new RegExp(search, 'i') } },
                    { 'shipping_address.phone': { $regex: new RegExp(search, 'i') } },
                    { 'shipping_address.address': { $regex: new RegExp(search, 'i') } },
                    { 'payment_method.name': { $regex: new RegExp(search, 'i') } }
                ]
            }
        } : { $match: {} };

        const orders = await Order.aggregate([
            ...lookupStages,
            searchMatchStage,
            { $sort: { createdAt: -1 } },
            { $skip: skipIndex },
            { $limit: limit }
        ]);

        const totalPipeline = [
            ...lookupStages,
            searchMatchStage,
            { $count: 'total' }
        ];

        const total = await Order.aggregate(totalPipeline);
        const totalOrders = total.length > 0 ? total[0].total : 0;

        const totalPages = Math.ceil(totalOrders / limit);
        if (totalOrders > 0 && page > totalPages) {
            return res.status(400).json({
                message: `Page ${page} does not exist. Total pages available: ${totalPages}`
            });
        }

        res.json({
            orders,
            currentPage: page,
            totalPages,
            totalOrders,
            limit
        });
    } catch (error) {
        console.error('Error in getAllOrders:', error);
        res.status(500).json({
            message: 'Server Error',
            error: error.message
        });
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
        const user = await User.findById(order.user_id)
        console.log(user.email);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (status) {
            if (order.status === 'cancelled' && status !== 'cancelled') {
                return res.status(400).json({ message: 'Cannot change status of cancelled order' });
            }
            if (order.status === 'success' && status !== 'success') {
                return res.status(400).json({ message: 'Cannot change status of success order' });
            }
            order.status = status;
        }
        if (payment_status) order.payment_status = payment_status;
        if (order.status == 'success' || order.payment_status == 'success') sendNoti(user.email, order)

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

// Cancel order
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

        // Verify order is success
        if (order.status !== 'success') {
            return res.status(400).json({ message: 'Can only review success orders' });
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
            { path: 'user_id', select: 'fullname email' }
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
                { path: 'user_id', select: 'fullname email' }
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
                { path: 'user_id', select: 'fullname email' }
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

exports.getOrderStatistics = async (req, res) => {
    try {
        // Get current date
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        // Calculate start of current day and week
        const startOfDay = new Date(currentDate.setHours(0, 0, 0, 0));
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay()); // Start of week (Sunday)
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 7);

        // Get status counts
        const orderStatusStats = await Order.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$status', 'success'] }, { $eq: ['$payment_status', 'success'] }] },
                                '$total',
                                0
                            ]
                        }
                    },
                }
            }
        ]);

        // Get payment status counts
        const paymentStatusStats = await Order.aggregate([
            {
                $group: {
                    _id: '$payment_status',
                    count: { $sum: 1 },
                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$status', 'success'] }, { $eq: ['$payment_status', 'success'] }] },
                                '$total',
                                0
                            ]
                        }
                    },
                }
            }
        ]);

        // Get daily statistics
        const dailyStats = await Order.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: startOfDay,
                        $lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$status', 'success'] }, { $eq: ['$payment_status', 'success'] }] },
                                '$total',
                                0
                            ]
                        }
                    },
                    averageOrderValue: { $avg: '$total' },
                    successfulOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'success'] }, 1, 0]
                        }
                    },
                    canceledOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        // Get weekly statistics
        const weeklyStats = await Order.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: startOfWeek,
                        $lt: endOfWeek
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$status', 'success'] }, { $eq: ['$payment_status', 'success'] }] },
                                '$total',
                                0
                            ]
                        }
                    },
                    averageOrderValue: { $avg: '$total' },
                    successfulOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'success'] }, 1, 0]
                        }
                    },
                    canceledOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        // Get monthly statistics
        const monthlyStats = await Order.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(currentYear, currentMonth - 1, 1),
                        $lt: new Date(currentYear, currentMonth, 1)
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$status', 'success'] }, { $eq: ['$payment_status', 'success'] }] },
                                '$total',
                                0
                            ]
                        }
                    },
                    averageOrderValue: { $avg: '$total' },
                    successfulOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'success'] }, 1, 0]
                        }
                    },
                    canceledOrders: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        // Get yearly statistics
        const yearlyStats = await Order.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(currentYear, 0, 1),
                        $lt: new Date(currentYear + 1, 0, 1)
                    }
                }
            },
            {
                $group: {
                    _id: { $month: '$createdAt' },
                    totalOrders: { $sum: 1 },
                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$status', 'success'] }, { $eq: ['$payment_status', 'success'] }] },
                                '$total',
                                0
                            ]
                        }
                    },
                    averageOrderValue: { $avg: '$total' }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        // Format response
        const statistics = {
            orderStatus: orderStatusStats.reduce((acc, curr) => {
                acc[curr._id] = {
                    count: curr.count,
                    totalAmount: curr.totalAmount
                };
                return acc;
            }, {}),
            paymentStatus: paymentStatusStats.reduce((acc, curr) => {
                acc[curr._id] = {
                    count: curr.count,
                    totalAmount: curr.totalAmount
                };
                return acc;
            }, {}),
            currentDay: {
                ...dailyStats[0],
                date: startOfDay.toISOString().split('T')[0]
            },
            currentWeek: {
                ...weeklyStats[0],
                startDate: startOfWeek.toISOString().split('T')[0],
                endDate: endOfWeek.toISOString().split('T')[0]
            },
            currentMonth: {
                ...monthlyStats[0],
                month: currentMonth,
                year: currentYear
            },
            yearlyStats: yearlyStats.map(stat => ({
                month: stat._id,
                totalOrders: stat.totalOrders,
                totalAmount: stat.totalAmount,
                averageOrderValue: stat.averageOrderValue
            })),
        };

        res.json({
            success: true,
            data: statistics
        });

    } catch (error) {
        console.error('Get order statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching order statistics'
        });
    }
};
// Get statistics for a specific date range
exports.getOrderStatisticsByDateRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required'
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        const statistics = await Order.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: start,
                        $lte: end
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalAmount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ['$status', 'success'] }, { $eq: ['$payment_status', 'success'] }] },
                                '$total',
                                0
                            ]
                        }
                    },
                    averageOrderValue: { $avg: '$total' },
                    ordersByStatus: {
                        $push: {
                            status: '$status',
                            total: '$total'
                        }
                    },
                    ordersByPaymentStatus: {
                        $push: {
                            paymentStatus: '$payment_status',
                            total: '$total'
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalOrders: 1,
                    totalAmount: 1,
                    averageOrderValue: 1,
                    ordersByStatus: 1,
                    ordersByPaymentStatus: 1
                }
            }
        ]);

        // Process status statistics
        const statusStats = {};
        const paymentStatusStats = {};

        if (statistics.length > 0) {
            statistics[0].ordersByStatus.forEach(order => {
                if (!statusStats[order.status]) {
                    statusStats[order.status] = {
                        count: 0,
                        totalAmount: 0
                    };
                }
                statusStats[order.status].count++;
                statusStats[order.status].totalAmount += order.total;
            });

            statistics[0].ordersByPaymentStatus.forEach(order => {
                if (!paymentStatusStats[order.paymentStatus]) {
                    paymentStatusStats[order.paymentStatus] = {
                        count: 0,
                        totalAmount: 0
                    };
                }
                paymentStatusStats[order.paymentStatus].count++;
                paymentStatusStats[order.paymentStatus].totalAmount += order.total;
            });
        }

        res.json({
            success: true,
            data: {
                period: {
                    start: startDate,
                    end: endDate
                },
                overview: statistics[0] ? {
                    totalOrders: statistics[0].totalOrders,
                    totalAmount: statistics[0].totalAmount,
                    averageOrderValue: statistics[0].averageOrderValue
                } : null,
                statusStatistics: statusStats,
                paymentStatusStatistics: paymentStatusStats
            }
        });

    } catch (error) {
        console.error('Get order statistics by date range error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching order statistics'
        });
    }
};