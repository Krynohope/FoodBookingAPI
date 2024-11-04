const express = require('express');
const router = express.Router();
const { check } = require('express-validator');
const authMiddleware = require('../middlewares/authMiddleware');
const userController = require('../controllers/userController');
const menuController = require('../controllers/menuController');
const categoryController = require('../controllers/categoryController');
const orderController = require('../controllers/orderController');
const { upload, handleMulterError } = require('../middlewares/uploadFile');

router.use(authMiddleware('admin'));


// User Management Routes
router.get('/users', [
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 100 })
], userController.getAllUsers);

router.post('/users', [
    check('full_name', 'Full name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
    check('role').optional().isIn(['customer', 'admin']),
    check('phone_number').optional().matches(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)
], userController.createUser);

router.put('/users/:id', [
    check('full_name').optional().not().isEmpty(),
    check('email').optional().isEmail(),
    check('role').optional().isIn(['customer', 'admin']),
    check('phone_number').optional().matches(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)
], userController.updateUser);

router.delete('/users/:id', userController.deleteUser);


// Menu Management Routes
router.get('/menus', [
    check('page').optional().isInt({ min: 1 }),
    check('limit').optional().isInt({ min: 1, max: 100 })
], menuController.getMenuItems);

router.post('/menus', [
    upload.single('image'),
    check('name', 'Name is required').not().isEmpty(),
    check('price', 'Price must be a positive number').isFloat({ min: 0 }),
    check('category_id', 'Category ID is required').not().isEmpty(),
    check('description').optional().trim()
], menuController.createMenuItem);

router.patch('/menus/:id', [
    upload.single('image'),
    check('name').optional().not().isEmpty(),
    check('price').optional().isFloat({ min: 0 }),
    check('category_id').optional().not().isEmpty(),
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
        check('payment_status').optional().isIn(['pending', 'paid', 'failed', 'refunded'])
    ]
], orderController.updateOrderStatus);

// Dashboard Statistics
router.get('/stats/orders', orderController.getOrderStats);

router.get('/stats/overview', async (req, res) => {
    try {
        // This route would combine various statistics
        const [orderStats, userStats, menuStats] = await Promise.all([
            orderController.getOrderStats(),
            userController.getUserStats(),
            menuController.getMenuStats()
        ]);

        res.json({
            orders: orderStats,
            users: userStats,
            menu: menuStats
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching dashboard statistics' });
    }
});

// Error handling for file uploads
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File is too large. Maximum size is 5MB' });
        }
        return res.status(400).json({ message: error.message });
    }
    if (error) {
        return res.status(400).json({ message: error.message });
    }
    next();
});

module.exports = router;