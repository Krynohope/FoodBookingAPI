const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const menuController = require('../controllers/menuController');
const { check, query } = require('express-validator');



// Public Routes

// Ví dụ dùng http://localhost:3000/api/menus?page=1 (limit mặc định là 10)
// Ví dụ dùng http://localhost:3000/api/menus?page=1&limit=5 (tùy chỉnh limit)
// Ví dụ dùng lọc theo category: http://localhost:3000/api/menus?category_id=123(&page=1&limit=10)
// Ví dụ dùng  lọc theo khoảng giá price: http://localhost:3000/api/menus?minPrice=10&maxPrice=50&(page=1&limit=10)
// Ví dụ dùng  lọc theo price sort: http://localhost:3000/api/menus?sort=price_asc(price_desc)&(page=1&limit=10)
// Ví dụ dùng  kết hợp: http://localhost:3000/api/menus?category_id=123&minPrice=10&maxPrice=50&(page=1&limit=10)

router.get('/', [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('category_id').optional().isMongoId().withMessage('Invalid category ID'),
    query('minPrice').optional().isFloat({ min: 0 }).toFloat(),
    query('maxPrice').optional().isFloat({ min: 0 }).toFloat().custom((value, { req }) => {
        if (req.query.minPrice && value <= req.query.minPrice) {
            throw new Error('maxPrice must be greater than minPrice');
        }
        return true;
    })
], menuController.getMenuItems);


//Lấy chi tiết món
router.get('/:id', menuController.getMenuItemById);



// Protected Routes
router.post('/', [authMiddleware('admin'), [
    check('menu_id', 'Menu ID is required').not().isEmpty(),
    check('name', 'Name is required').not().isEmpty(),
    check('price', 'Price is required and must be a number').isFloat({ gt: 0 }),
]], menuController.createMenuItem);

router.put('/:id', [authMiddleware('admin'), [
    check('menu_id', 'Menu ID must be a valid ID').optional().isMongoId(),
    check('price', 'Price must be a number').optional().isFloat({ gt: 0 }),
]], menuController.updateMenuItem);

router.delete('/:id', authMiddleware('admin'), menuController.deleteMenuItem);



module.exports = router;