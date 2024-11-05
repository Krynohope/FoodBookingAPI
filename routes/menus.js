const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const menuController = require('../controllers/menuController');
const { check, query } = require('express-validator');




// Ví dụ dùng http://localhost:3000/api/menus?page=1 (limit mặc định là 10)
// Ví dụ dùng http://localhost:3000/api/menus?page=1&limit=5 (tùy chỉnh limit)
// Ví dụ dùng lọc theo category: http://localhost:3000/api/menus?category=123(&page=1&limit=10)
// Ví dụ dùng  lọc theo khoảng giá price: http://localhost:3000/api/menus?minPrice=10&maxPrice=50&(page=1&limit=10)
// Ví dụ dùng  lọc theo price sort: http://localhost:3000/api/menus?sort=price_asc(price_desc)&(page=1&limit=10)
// Ví dụ dùng  kết hợp: http://localhost:3000/api/menus?category=123&minPrice=10&maxPrice=50&(page=1&limit=10)

router.get('/', [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
    query('category').optional().isMongoId().withMessage('Invalid category ID'),
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







module.exports = router;