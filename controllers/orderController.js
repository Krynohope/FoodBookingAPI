const { validationResult } = require('express-validator');
const Order = require('../models/Order');
const OrderItem = require('../models/OrderItem');
const Dish = require('../models/Dish');

// Tạo đơn hàng mới
exports.createOrder = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { dishes, shipping_address, payment_method } = req.body;

    try {
        let total_price = 0;
        for (const item of dishes) {
            const dish = await Dish.findById(item.dish_id);
            if (!dish) return res.status(404).json({ message: `Dish with ID ${item.dish_id} not found` });
            total_price += parseFloat(dish.price) * item.quantity;
        }

        const order = new Order({
            user: req.user.id,
            total_price: total_price.toFixed(2),
            payment_method,
            shipping_address,
        });

        await order.save();

        for (const item of dishes) {
            const dish = await Dish.findById(item.dish_id);
            const orderItem = new OrderItem({
                order: order.id,
                dish: dish.id,
                quantity: item.quantity,
                price: (parseFloat(dish.price) * item.quantity).toFixed(2),
            });
            await orderItem.save();
        }

        res.status(201).json({ message: 'Order placed successfully', order_id: order.id });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Lấy danh sách đơn hàng của người dùng
exports.getUserOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user.id })
            .populate('order_items', 'dish quantity price')
            .populate({
                path: 'order_items',
                populate: {
                    path: 'dish',
                    select: 'name price',
                },
            })
            .sort({ created_at: -1 });
        res.json(orders);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Lấy chi tiết đơn hàng theo ID
exports.getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('order_items', 'dish quantity price')
            .populate({
                path: 'order_items',
                populate: {
                    path: 'dish',
                    select: 'name price',
                },
            });

        if (!order) return res.status(404).json({ message: 'Order not found' });

        if (order.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access forbidden: Not your order' });
        }

        res.json(order);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};
