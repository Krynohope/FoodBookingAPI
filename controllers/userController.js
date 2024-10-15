const { validationResult } = require('express-validator');
const User = require('../models/User');
const bcrypt = require('bcrypt');

// Lấy thông tin người dùng hiện tại
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Cập nhật thông tin người dùng
exports.updateProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { full_name, email, password, phone_number, address } = req.body;

    const userFields = {};
    if (full_name) userFields.full_name = full_name;
    if (email) userFields.email = email;
    if (phone_number) userFields.phone_number = phone_number;
    if (address) userFields.address = address;
    if (password) userFields.password = password;

    try {
        let user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (password) {
            const salt = await bcrypt.genSalt(10);
            userFields.password = await bcrypt.hash(password, salt);
        }

        user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: userFields },
            { new: true }
        ).select('-password');

        res.json(user);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};
