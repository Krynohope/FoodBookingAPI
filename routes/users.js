const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { check } = require('express-validator');
const { getProfile, updateProfile, removeAddress } = require('../controllers/userController');
const { upload, handleMulterError } = require('../middlewares/uploadFile');

router.use(authMiddleware());

router.get('/profile', getProfile);

router.patch('/profile',
    upload.single('avatar'),
    handleMulterError,
    [
        check('fullname', 'Full name is required').optional().not().isEmpty(),
        check('email', 'Please include a valid email').optional().isEmail(),
        check('password', 'Password must be at least 6 characters').optional().isLength({ min: 6 }),
        check('phone').optional(),
        check('address').optional()
    ],
    updateProfile
);
router.delete('/address', removeAddress);


module.exports = router;
