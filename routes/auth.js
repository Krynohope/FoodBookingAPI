const express = require('express');
const router = express.Router();
const { register, login, verifyEmail, forgotPassword, resetPassword, resendVerificationCode, logout, changePassword } = require('../controllers/authController');
const { check } = require('express-validator');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/register', [
    check('fullname', 'Full name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
], register);

router.post('/verify-email', [
    check('email', 'Please include a valid email').isEmail(),
    check('code', 'Verification code is required').not().isEmpty(),
], verifyEmail);

router.post('/resend-verification-code', [
    check('email', 'Please include a valid email').isEmail(),
], resendVerificationCode);

router.post('/login', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
], login);

router.post('/logout', logout);

router.post('/forgot-password', [
    check('email', 'Please include a valid email').isEmail(),
], forgotPassword);

router.post('/reset-password', [
    check('token', 'Reset token is required').not().isEmpty(),
    check('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 }),
], resetPassword);

router.post('/change-password', authMiddleware(),
    [
        check('currentPassword', 'Current password is required').not().isEmpty(),
        check('newPassword', 'New password must be at least 6 characters')
            .isLength({ min: 6 })
            .custom((value, { req }) => {
                if (value == req.body.currentPassword) {
                    throw new Error('New password must be different from current password');
                }
                return true;
            }),
        check('confirmPassword', 'Passwords do not match')
            .custom((value, { req }) => {
                if (value != req.body.newPassword) {
                    throw new Error('Password confirmation does not match new password');
                }
                return true;
            })
    ],
    changePassword
);

module.exports = router;