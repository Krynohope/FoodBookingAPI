var mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDb = async () => {
    try {
        const connect = await mongoose.connect(process.env.MONGODB_URI)
        return connect
    } catch (error) {
        console.error('Error fetching data from database:', error);
        res.status(500).send('Internal Server Error');
    }

}
module.exports = { connectDb }