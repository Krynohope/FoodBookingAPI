const express = require('express');
const router = express.Router();
const {
    getVouchers,
    getVoucherById,
    applyVoucher,
} = require('../controllers/voucherController');


router.get('/', getVouchers);
router.get('/:id', getVoucherById);
router.post('/apply', applyVoucher);


module.exports = router;