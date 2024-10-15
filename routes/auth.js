const express = require('express');
const router = express.Router();
const { register, login, verifyEmail, forgotPassword, resetPassword } = require('../controllers/authController');
const { check } = require('express-validator');

router.post('/register', [
    check('full_name', 'Full name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
], register);

router.post('/verify-email', [
    check('email', 'Please include a valid email').isEmail(),
    check('code', 'Verification code is required').not().isEmpty(),
], verifyEmail);

router.post('/login', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
], login);

router.post('/forgot-password', [
    check('email', 'Please include a valid email').isEmail(),
], forgotPassword);

router.post('/reset-password', [
    check('token', 'Reset token is required').not().isEmpty(),
    check('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 }),
], resetPassword);

module.exports = router;