const { validationResult } = require('express-validator');
const User = require('../models/User');
const { removeUploadedFile } = require('../middlewares/uploadFile');
const path = require('path');
const fs = require('fs');


//Get  user by ID
exports.getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error in getUserById:', error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid user ID' });
        }
        res.status(500).json({ message: 'Server Error' });
    }
};

//Get current user profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error in getProfile:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
};

//Update userprofile
exports.updateProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        if (req.file) {
            removeUploadedFile(req.file.path);
        }
        return res.status(400).json({ errors: errors.array() });
    }

    const { fullname, phone, address } = req.body;

    const userFields = {};
    if (fullname) userFields.fullname = fullname;
    if (phone) userFields.phone = phone;
    if (address) {
        // Add new address to the array if it doesn't exist
        userFields.$addToSet = { address: address };
    }

    // Handle avatar upload
    if (req.file) {
        userFields.avatar = `${process.env.DOMAIN}/images/${req.file.filename}`;
    }

    try {
        let user = await User.findById(req.user.id);
        if (!user) {
            if (req.file) {
                removeUploadedFile(req.file.path);
            }
            return res.status(404).json({ message: 'User not found' });
        }

        if (req.file && user.avatar) {
            const oldPath = path.join('public', user.avatar.replace(process.env.DOMAIN, ''));
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        user = await User.findByIdAndUpdate(
            req.user.id,
            userFields,
            { new: true }
        ).select('-password');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: user
        });
    } catch (error) {
        if (req.file) {
            removeUploadedFile(req.file.path);
        }
        console.error('Error in updateProfile:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
};

// Remove address
exports.removeAddress = async (req, res) => {
    const { address } = req.body;

    try {
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $pull: { address: address } },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            success: true,
            message: 'Address removed successfully',
            data: user
        });
    } catch (error) {
        console.error('Error in removeAddress:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
};



// Admin method
//  Get all users with pagi
exports.getAllUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const users = await User.find()
            .select('-password')
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments();

        res.json({
            users,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalUsers: total,
                hasMore: skip + users.length < total
            }
        });
    } catch (error) {
        console.error('Error in getAllUsers:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
};

// admin Create
exports.createUser = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { fullname, email, password, phone } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        user = new User({
            fullname,
            email,
            password,
            phone,
        });


        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json(userResponse);
    } catch (error) {
        console.error('Error in createUser:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
};


// Admin update user
exports.updateUser = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {

        const userToUpdate = await User.findById(req.params.id);

        if (!userToUpdate) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if trying to update another admin account
        if (userToUpdate.role === 'admin' && req.user._id.toString() !== userToUpdate._id.toString()) {
            return res.status(403).json({ message: 'Cannot modify other admin accounts' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        ).select('-password');

        res.json(user);
    } catch (error) {
        console.error('Error in updateUser:', error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid user ID' });
        }
        res.status(500).json({ message: 'Server Error' });
    }
};

// Delete user
exports.deleteUser = async (req, res) => {
    try {
        const userToDelete = await User.findById(req.params.id);

        if (!userToDelete) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if trying to delete another admin account
        if (userToDelete.role === 'admin' && req.user._id.toString() !== userToDelete._id.toString()) {
            return res.status(403).json({ message: 'Cannot delete other admin accounts' });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error in deleteUser:', error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid user ID' });
        }
        res.status(500).json({ message: 'Server Error' });
    }
};