const axios = require('axios').default;
const CryptoJS = require('crypto-js');
const qs = require('qs')
const moment = require('moment');
const orderModel = require('../models/Order');
const Order = require('../models/Order');


const config = {
    app_id: "2554",
    key1: "sdngKKJmqEMzvh5QQcdD2A9XBSKUNaYn",
    key2: "trMrHtvjo6myautxDUiAcYsVtaeQ8nhf",
    endpoint: "https://sb-openapi.zalopay.vn/v2/create"
};

const payment = async (req, res) => {


    const embed_data = {
        redirecturl: 'http://localhost:4200/home',
    };

    const orderData = req.order;



    const transID = Math.floor(Math.random() * 1000000);

    const order = {
        app_id: config.app_id,
        app_trans_id: `${moment().format('YYMMDD')}_${transID}`, // translation missing: vi.docs.shared.sample_code.comments.app_trans_id
        app_user: orderData.user_id,
        app_time: Date.now(), // miliseconds
        item: JSON.stringify(orderData.orderDetail),
        embed_data: JSON.stringify(embed_data),
        amount: orderData.total,
        description: `Thanh toán cho đơn hàng #${orderData.order_id}`,
        bank_code: "",
        // callback_url: 'https://7d8c-2402-800-63f3-f2db-c99c-8d79-23f3-e0ca.ngrok-free.app/api/zalopay/callback'
        callback_url: 'https://foodbookingapi.onrender.com/api/zalopay/callback'
    };

    orderData.app_trans_id = order.app_trans_id
    await Order.findOneAndUpdate({ order_id: orderData.order_id }, { app_trans_id: orderData.app_trans_id })


    // appid|app_trans_id|appuser|amount|apptime|embeddata|item
    const data = config.app_id + "|" + order.app_trans_id + "|" + order.app_user + "|" + order.amount + "|" + order.app_time + "|" + order.embed_data + "|" + order.item;
    order.mac = CryptoJS.HmacSHA256(data, config.key1).toString();
    try {
        const result = await axios.post(config.endpoint, null, { params: order })
        // await Order.findOneAndUpdate({ app_trans_id: dataJson["app_trans_id"] }, { payment_status: 'failed', status: 'canceled' });

        return result.data
    } catch (error) {
        return res.status(400).json(error)
    }
}

const zlpCallback = async (req, res) => {
    let result = {};

    try {
        let dataStr = req.body.data;
        let reqMac = req.body.mac;

        let mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();
        console.log("mac =", mac);


        // kiểm tra callback hợp lệ (đến từ ZaloPay server)
        if (reqMac !== mac) {
            // callback không hợp lệ
            result.return_code = -1;
            result.return_message = "mac not equal";
        }
        else {
            // thanh toán thành công
            // merchant cập nhật trạng thái cho đơn hàng

            let dataJson = JSON.parse(dataStr, config.key2);
            console.log("update order's status = success where app_trans_id =", dataJson["app_trans_id"]);

            await Order.findOneAndUpdate({ app_trans_id: dataJson["app_trans_id"] }, { payment_status: 'success', status: 'processing' });

            result.return_code = 1;
            result.return_message = "success";
        }
    } catch (ex) {
        result.return_code = 0; // ZaloPay server sẽ callback lại (tối đa 3 lần)
        result.return_message = ex.message;
    }

    // thông báo kết quả cho ZaloPay server
    res.json(result);
}

const checkStatus = async (req, res) => {
    const app_trans_id = req.params.app_trans_id

    let postData = {
        app_id: config.app_id,
        app_trans_id: app_trans_id // Input your app_trans_id
    }

    let data = postData.app_id + "|" + postData.app_trans_id + "|" + config.key1; // appid|app_trans_id|key1
    postData.mac = CryptoJS.HmacSHA256(data, config.key1).toString();


    let postConfig = {
        method: 'post',
        url: 'https://sb-openapi.zalopay.vn/v2/query',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: qs.stringify(postData)
    };

    try {
        const result = await axios(postConfig)
        if (result.data.return_code === 2 || result.data.return_code === 3) {
            await Order.findOneAndUpdate({ app_trans_id }, { payment_status: 'failed', status: 'cancelled' });
        }
        return res.status(200).json(result.data);
    } catch (error) {
        return res.status(500).json(error)
    }
}


module.exports = { payment, zlpCallback, checkStatus }