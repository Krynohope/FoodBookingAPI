const { check } = require('express-validator');
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
    getMenus,
    getMenuById,
    createMenu,
    updateMenu,
    deleteMenu
} = require('../controllers/menuController');

// Public Routes: Xem danh sách menu và chi tiết menu
router.get('/', getMenus);
router.get('/:id', getMenuById);

// Protected Routes: Chỉ Admin mới có thể thêm, sửa, xóa menu
router.post('/', [authMiddleware('admin'), [
    check('name', 'Name is required').not().isEmpty(),
]], createMenu);

router.put('/:id', [authMiddleware('admin'), [
    check('name', 'Name is required').optional().not().isEmpty(),
]], updateMenu);

router.delete('/:id', authMiddleware('admin'), deleteMenu);

module.exports = router;
