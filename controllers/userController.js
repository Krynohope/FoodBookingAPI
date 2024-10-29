const { validationResult } = require('express-validator');
const User = require('../models/User');
const bcrypt = require('bcrypt');

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
        // If there's a file uploaded but validation failed, remove it
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error removing uploaded file:', err);
            });
        }
        return res.status(400).json({ errors: errors.array() });
    }

    const { full_name, email, password, phone_number, address } = req.body;

    const userFields = {};
    if (full_name) userFields.full_name = full_name;
    if (email) userFields.email = email;
    if (phone_number) userFields.phone_number = phone_number;
    if (address) userFields.address = address;

    // Handle avatar upload
    if (req.file) {
        userFields.avatar = req.file.filename;
    }

    try {
        let user = await User.findById(req.user.id);
        if (!user) {
            if (req.file) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error('Error removing uploaded file:', err);
                });
            }
            return res.status(404).json({ message: 'User not found' });
        }

        if (email && email !== user.email) {
            const emailExists = await User.findOne({ email });
            if (emailExists) {
                if (req.file) {
                    fs.unlink(req.file.path, (err) => {
                        if (err) console.error('Error removing uploaded file:', err);
                    });
                }
                return res.status(400).json({ message: 'Email already in use' });
            }
        }

        if (password) {
            const salt = await bcrypt.genSalt(10);
            userFields.password = await bcrypt.hash(password, salt);
        }

        // If there's a new avatar, remove the old one
        if (req.file && user.avatar) {
            const oldAvatarPath = path.join('./public/images', user.avatar);
            fs.unlink(oldAvatarPath, (err) => {
                if (err && err.code !== 'ENOENT') {
                    console.error('Error removing old avatar:', err);
                }
            });
        }

        user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: userFields },
            { new: true }
        ).select('-password');

        // Add full avatar URL to response
        const userResponse = user.toObject();
        if (userResponse.avatar) {
            userResponse.avatarUrl = `/images/${userResponse.avatar}`;
        }

        res.json(userResponse);
    } catch (error) {
        // Clean up uploaded file if there's an error
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error removing uploaded file:', err);
            });
        }
        console.error('Error in updateProfile:', error.message);
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

    const { full_name, email, password, phone_number, address } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        user = new User({
            full_name,
            email,
            password,
            avatar: 'http://localhost:3000/public/images/default.jgp',
            phone_number,
            address
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

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
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

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
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
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