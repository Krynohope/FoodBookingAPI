const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authMiddleware = require('../middlewares/authMiddleware');

const {
    getReviews,
    getReviewById,
    createReview,
} = require('../controllers/reviewController');

// Validation middleware
const reviewValidation = [
    body('order_id')
        .notEmpty()
        .withMessage('Order ID is required'),
    body('rating')
        .isInt({ min: 1, max: 5 })
        .withMessage('Rating must be between 1 and 5'),
    body('comment')
        .optional()
        .trim()
        .isLength({ min: 3, max: 500 })
        .withMessage('Comment must be between 3 and 500 characters')
];

//Get with pagi and fillter(user_id,order_id,rating)
router.get('/', getReviews);
router.get('/:id', getReviewById);

router.post('/',
    authMiddleware(),
    reviewValidation,
    createReview
);

// Admin routes


module.exports = router;