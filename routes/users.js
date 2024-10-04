const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { getProfile, updateProfile } = require('../controllers/userController');
const { check } = require('express-validator');

router.use(authMiddleware());

router.get('/profile', getProfile);

router.put('/profile', [
    check('full_name', 'Full name is required').optional().not().isEmpty(),
    check('email', 'Please include a valid email').optional().isEmail(),
    check('password', 'Password must be at least 6 characters').optional().isLength({ min: 6 }),
], updateProfile);

module.exports = router;
