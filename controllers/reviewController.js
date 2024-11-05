const { validationResult } = require('express-validator');
const Review = require('../models/Review');
const Order = require('../models/Order');

// Get reviews with pagination and filters
exports.getReviews = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { user_id, order_id, rating } = req.query;

        let query = {};
        if (user_id) query.user_id = user_id;
        if (order_id) query.order_id = order_id;
        if (rating) query.rating = rating;

        const total = await Review.countDocuments(query);
        const reviews = await Review.find(query)
            .populate('user_id', 'name email') // Assuming user has these fields
            .populate('order_id', 'order_number') // Assuming order has this field
            .select('-__v')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            success: true,
            data: {
                reviews,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: limit
                }
            }
        });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching reviews'
        });
    }
};

// Get single review
exports.getReviewById = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id)
            .populate('user_id', 'name email')
            .populate('order_id', 'order_number')
            .select('-__v');

        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        res.json({ success: true, data: review });
    } catch (error) {
        console.error('Get review error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching review'
        });
    }
};

// Create review (only for users who bought the product)
exports.createReview = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { order_id, rating, comment } = req.body;
        const user_id = req.user.id; // Assuming user ID is available from auth middleware

        // Check if order exists and belongs to the user
        const order = await Order.findOne({
            _id: order_id,
            user_id: user_id,
            status: 'success' // Assuming you only want reviews for delivered orders
        });

        if (!order) {
            return res.status(403).json({
                success: false,
                message: 'You can only review orders that you have purchased and received'
            });
        }

        // Check if user has already reviewed this order
        const existingReview = await Review.findOne({ order_id, user_id });
        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'You have already reviewed this order'
            });
        }

        const review = new Review({
            user_id,
            order_id,
            rating,
            comment
        });

        await review.save();

        const populatedReview = await Review.findById(review._id)
            .populate('user_id', 'name email')
            .populate('order_id', 'order_number');

        res.status(201).json({
            success: true,
            message: 'Review submitted successfully',
            data: populatedReview
        });

    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating review'
        });
    }
};

// Delete review (admin only)
exports.deleteReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Review not found'
            });
        }

        await review.deleteOne();

        res.json({
            success: true,
            message: 'Review deleted successfully',
            data: { id: req.params.id }
        });

    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting review'
        });
    }
};