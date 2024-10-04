const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    getMenus,
    createMenu,
    updateMenu,
    deleteMenu,
    getDishes,
    createDish,
    updateDish,
    deleteDish,
    getOrders,
    updateOrderStatus
} = require('../controllers/adminController');

router.use(authMiddleware('admin'));

// Quản lý người dùng
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Quản lý menu
router.get('/menus', getMenus);
router.post('/menus', createMenu);
router.put('/menus/:id', updateMenu);
router.delete('/menus/:id', deleteMenu);

// Quản lý món ăn
router.get('/dishes', getDishes);
router.post('/dishes', createDish);
router.put('/dishes/:id', updateDish);
router.delete('/dishes/:id', deleteDish);

// Quản lý đơn hàng
router.get('/orders', getOrders);
router.put('/orders/:id/status', updateOrderStatus);



module.exports = router;
