const mongoose = require('mongoose');
const fs = require('fs');
const Menu = require('./models/Menu'); // Đảm bảo đường dẫn đến file model `Menu.js`

// Kết nối MongoDB
const { connectDb } = require('./config/connect');
connectDb()

// Đọc file JSON chứa dữ liệu
const products = JSON.parse(fs.readFileSync('./menuData.json', 'utf8'));

async function importData() {
    try {
        for (const product of products) {
            await Menu.create(product); // Sử dụng `create` để kích hoạt middleware `pre-save`
            console.log(`Đã thêm sản phẩm: ${product.name}`);
        }
        console.log("Import dữ liệu thành công!");
    } catch (error) {
        console.error("Lỗi khi import dữ liệu:", error);
    } finally {
        mongoose.connection.close();
    }
}

importData();
