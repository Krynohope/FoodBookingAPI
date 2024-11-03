const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { check } = require('express-validator');
const { getProfile, updateProfile } = require('../controllers/userController');
const { upload, handleMulterError } = require('../middlewares/uploadFile');

router.use(authMiddleware());

router.get('/profile', getProfile);

router.put('/profile',
    upload.single('avatar'),
    handleMulterError,
    [
        check('full_name', 'Full name is required').optional().not().isEmpty(),
        check('email', 'Please include a valid email').optional().isEmail(),
        check('password', 'Password must be at least 6 characters').optional().isLength({ min: 6 }),
        check('phone_number').optional(),
        check('address').optional()
    ],
    updateProfile
);



module.exports = router;
