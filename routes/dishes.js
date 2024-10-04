const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
    getDishesWithPagi,
    getDishById,
    createDish,
    updateDish,
    deleteDish
} = require('../controllers/dishController');
const { check, query } = require('express-validator');



// Public Routes: Xem danh sách món ăn và chi tiết món ăn

// Ví dụ dùng http://localhost:3000/api/dishes?page=1 (limit mặc định là 10)
// Ví dụ dùng http://localhost:3000/api/dishes?page=1&limit=5 (tùy chỉnh limit)
router.get('/', [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
], getDishesWithPagi);


//Lấy chi tiết món
router.get('/:id', getDishById);



// Protected Routes: Chỉ Admin mới có thể thêm, sửa, xóa món ăn
router.post('/', [authMiddleware('admin'), [
    check('menu_id', 'Menu ID is required').not().isEmpty(),
    check('name', 'Name is required').not().isEmpty(),
    check('price', 'Price is required and must be a number').isFloat({ gt: 0 }),
]], createDish);

router.put('/:id', [authMiddleware('admin'), [
    check('menu_id', 'Menu ID must be a valid ID').optional().isMongoId(),
    check('price', 'Price must be a number').optional().isFloat({ gt: 0 }),
]], updateDish);

router.delete('/:id', authMiddleware('admin'), deleteDish);



module.exports = router;