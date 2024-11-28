var express = require('express');
var router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const zlpController = require('../controllers/zalopayController')





router.post('/', authMiddleware(), zlpController.payment);
router.post('/callback', zlpController.zlpCallback);
router.post('/order-status/:app_trans_id', zlpController.checkStatus)


module.exports = router;
