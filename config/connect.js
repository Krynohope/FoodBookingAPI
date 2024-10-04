var mongoose = require('mongoose');
const connectDb = async () => {
    try {
        const connect = await mongoose.connect('mongodb://0.0.0.0:27017/DATN')
        return connect
    } catch (error) {
        console.error('Error fetching data from database:', error);
        res.status(500).send('Internal Server Error');
    }

}
module.exports = { connectDb }