var express = require('express');
var router = express.Router();
const zlpController = require('../controllers/api/zalopayController')
const auth = require('../middlewares/auth')




router.post('/', auth.validateAccessToken, zlpController.payment);
router.post('/callback', zlpController.zlpCallback);
router.post('/order-status/:app_trans_id', zlpController.checkStatus)


module.exports = router;
