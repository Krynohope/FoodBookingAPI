const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { check } = require('express-validator');
const { getProfile, updateProfile, addAddress, updateAddress, removeAddress } = require('../controllers/userController');
const { upload, handleMulterError } = require('../middlewares/uploadFile');

router.use(authMiddleware());

//Ge and update profile
router.get('/profile', getProfile);

router.patch('/profile',
    upload.single('avatar'),
    handleMulterError,
    [
        check('fullname', 'Full name is required').optional().not().isEmpty(),
        check('email', 'Please include a valid email').optional().isEmail(),
        check('phone').optional(),
    ],
    updateProfile
);

// Address routes
router.post('/address',
    [
        check('receiver', 'Receiver name is required').not().isEmpty(),
        check('phone', 'Phone number is required')
            .not().isEmpty()
            .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)
            .withMessage('Please provide a valid phone number'),
        check('address', 'Address is required').not().isEmpty()
    ],
    addAddress
);

router.patch('/address/:addressId',
    [
        check('receiver').optional().not().isEmpty(),
        check('phone')
            .optional()
            .matches(/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/)
            .withMessage('Please provide a valid phone number'),
        check('address').optional().not().isEmpty()
    ],
    updateAddress
);

router.delete('/address/:addressId', removeAddress);


module.exports = router;
