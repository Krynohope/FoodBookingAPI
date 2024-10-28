const { check } = require('express-validator');
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const categoryController = require('../controllers/categoryController');

// Public Routes
router.get('/', categoryController.getCategories);
router.get('/:id', categoryController.getCategoryById);



// Protected Routes
router.post('/', [authMiddleware('admin'), [
    check('name', 'Name is required').not().isEmpty(),
]], categoryController.createCategory);

router.put('/:id', [authMiddleware('admin'), [
    check('name', 'Name is required').optional().not().isEmpty(),
]], categoryController.updateCategory);

router.delete('/:id', authMiddleware('admin'), categoryController.deleteCategory);



module.exports = router;
