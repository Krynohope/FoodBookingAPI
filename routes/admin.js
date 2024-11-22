const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const authMiddleware = require('../middlewares/authMiddleware');
const userController = require('../controllers/userController');
const menuController = require('../controllers/menuController');
const categoryController = require('../controllers/categoryController');
const orderController = require('../controllers/orderController');
const payment_methodController = require('../controllers/payment_methodController');
const voucherController = require('../controllers/voucherController');
const { upload, handleMulterError } = require('../middlewares/uploadFile');
const { body } = require('express-validator');

router.use(authMiddleware('admin'));


// User Management Routes
router.get('/users', [
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 100 })
], userController.getAllUsers);

router.post('/users', [
    check('fullname', 'Full name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
], userController.createUser);

router.patch('/users/:id', [
    check('fullname').optional().not().isEmpty(),
    check('email').optional().isEmail(),
], userController.updateUser);

router.delete('/users/:id', userController.deleteUser);


// Menu Management Routes
router.get('/menus', [
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 100 })
], menuController.getMenuItems);

router.post('/menus', [
    upload.single('img'),
    check('name', 'Name is required').not().isEmpty(),
    check('price', 'Price must be a positive number').isFloat({ min: 0 }),
    check('quantity', 'Quantity must be a positive number').isFloat({ min: 0 }),
    check('category', 'Category  is required').not().isEmpty(),
    check('description').optional().trim()
], menuController.createMenuItem);

router.patch('/menus/:id', [
    upload.single('img'),
    check('name').optional().not().isEmpty(),
    check('price').optional().isFloat({ min: 0 }),
    check('quantity').optional().isFloat({ min: 0 }),
    check('category').optional().not().isEmpty(),
    check('description').optional().trim()
], menuController.updateMenuItem);

router.delete('/menus/:id', menuController.deleteMenuItem);


// Category Management Routes
router.post('/cate/',
    upload.single('img'),
    handleMulterError,
    categoryController.createCategory
);

router.patch('/cate/:id',
    upload.single('img'),
    handleMulterError,
    categoryController.updateCategory
);

router.delete('/cate/:id', categoryController.deleteCategory);


// Order Management Routes
router.get('/orders', [
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 100 }),
    check('status').optional().isIn(['pending', 'processing', 'completed', 'cancelled']),
    check('startDate').optional().isISO8601(),
    check('endDate').optional().isISO8601()
], orderController.getAllOrders);

router.patch('/orders/:id/status', [
    authMiddleware('admin'),
    [
        check('status').optional().isIn(['pending', 'processing', 'completed', 'cancelled']),
        check('payment_status').optional().isIn(['pending', 'paid', 'failed'])
    ]
], orderController.updateOrderStatus);


//Review management
router.get('/reviews', orderController.getAllReviews);



//Vouchers management
const voucherValidation = [
    body('name').notEmpty().trim().withMessage('Name is required'),
    body('code').notEmpty().trim().withMessage('Code is required'),
    body('discount_percent').isFloat({ min: 0, max: 100 }).withMessage('Discount percent must be between 0 and 100'),
    body('start').isISO8601().withMessage('Start date must be valid'),
    body('end').isISO8601().withMessage('End date must be valid'),
    body('limit').isInt({ min: 0 }).withMessage('Limit must be a positive number'),
    body('min_price')
];

router.post('/vouchers',
    upload.single('img'),
    voucherValidation,
    voucherController.createVoucher
);

router.patch('/vouchers/:id',
    upload.single('img'),
    voucherController.updateVoucher
);

router.delete('/vouchers/:id',
    voucherController.deleteVoucher
);


//Payment methods

// Validation middleware
const paymentMethodValidation = [
    check('name', 'Name is required').not().isEmpty(),
    check('type', 'Type is required').not().isEmpty(),
    check('status', 'Status is required').not().isEmpty()
];
router.post('/payment_methods',
    upload.single('img'),
    paymentMethodValidation,
    payment_methodController.createPaymentMethod
);
router.patch('/payment_methods/:id',
    upload.single('img'),
    payment_methodController.updatePaymentMethod
);
router.delete('/payment_methods/:id', payment_methodController.deletePaymentMethod);


// Dashboard Statistics
router.get('/statistics', authMiddleware('admin'), orderController.getOrderStatistics);
router.get('/statistics/range', authMiddleware('admin'), orderController.getOrderStatisticsByDateRange);


module.exports = router;