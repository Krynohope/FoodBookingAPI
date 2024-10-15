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


var multer = require('multer');
let storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/images')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
})
function checkFileUpLoad(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
        return cb(new Error('Bạn chỉ được upload file ảnh'));
    }
    cb(null, true);
}
let upload = multer({ storage: storage, fileFilter: checkFileUpLoad })


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
