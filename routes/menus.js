const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const menuController = require('../controllers/menuController');
const { check, query } = require('express-validator');



// Public Routes

// Ví dụ dùng http://localhost:3000/api/dishes?page=1 (limit mặc định là 10)
// Ví dụ dùng http://localhost:3000/api/dishes?page=1&limit=5 (tùy chỉnh limit)
router.get('/', [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt()
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