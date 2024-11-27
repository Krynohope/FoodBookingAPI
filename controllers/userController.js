const { validationResult } = require('express-validator');
const User = require('../models/User');
const Order = require('../models/Order');
const { removeUploadedFile } = require('../middlewares/uploadFile');



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
        user.avatar.startsWith('https') ? user.avatar = user.avatar : user.avatar = `${process.env.DOMAIN}/images/${user.avatar}`

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
        if (req.fileData) {
            await removeUploadedFile(req.fileData.fileId);
        }
        return res.status(400).json({ errors: errors.array() });
    }

    const { fullname, phone } = req.body;

    try {
        let user = await User.findById(req.user.id);
        if (!user) {
            if (req.fileData) {
                await removeUploadedFile(req.fileData.fileId);
            }
            return res.status(404).json({ message: 'User not found' });
        }

        if (fullname) user.fullname = fullname;
        if (phone) user.phone = phone;

        // Handle avatar upload
        if (req.fileData) {
            // Remove old avatar from Google Drive if exists
            if (user.avatar && user.avatar.fileId) {
                await removeUploadedFile(user.avatar.fileId);
            }

            // Update with new avatar data
            user.avatar = {
                fileId: req.fileData.fileId,
                downloadUrl: req.fileData.downloadLink
            };
        }

        await user.save();
        const updatedUser = await User.findById(user._id).select('-password');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedUser
        });
    } catch (error) {
        if (req.fileData) {
            await removeUploadedFile(req.fileData.fileId);
        }
        console.error('Error in updateProfile:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
};

// Add shipping address
exports.addAddress = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const newAddress = {
            receiver: req.body.receiver,
            phone: req.body.phone,
            address: req.body.address
        };

        user.address.push(newAddress);
        await user.save();

        res.status(201).json({
            success: true,
            message: 'Address added successfully',
            data: user.address[user.address.length - 1]
        });
    } catch (error) {
        console.error('Error in addAddress:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
};

// Update shipping address
exports.updateAddress = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const addressIndex = user.address.findIndex(
            addr => addr._id.toString() === req.params.addressId
        );

        if (addressIndex === -1) {
            return res.status(404).json({ message: 'Address not found' });
        }

        // Update address fields
        user.address[addressIndex] = {
            ...user.address[addressIndex].toObject(),
            receiver: req.body.receiver || user.address[addressIndex].receiver,
            phone: req.body.phone || user.address[addressIndex].phone,
            address: req.body.address || user.address[addressIndex].address
        };

        await user.save();

        res.json({
            success: true,
            message: 'Address updated successfully',
            data: user.address[addressIndex]
        });
    } catch (error) {
        console.error('Error in updateAddress:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
};

// Remove shipping address
exports.removeAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const addressExists = user.address.some(
            addr => addr._id.toString() === req.params.addressId
        );

        if (!addressExists) {
            return res.status(404).json({ message: 'Address not found' });
        }

        user.address = user.address.filter(
            addr => addr._id.toString() !== req.params.addressId
        );

        await user.save();

        res.json({
            success: true,
            message: 'Address removed successfully'
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

        const { search } = req.query;

        // Build search query
        let searchQuery = {};

        if (search) {
            searchQuery = {
                $or: [
                    { fullname: { $regex: new RegExp(search, 'i') } },
                    { email: { $regex: new RegExp(search, 'i') } }
                ]
            };
        }
        // Apply search query to find users
        const users = await User.find(searchQuery)
            .select('-password')
            .skip(skip)
            .limit(limit);

        // Get total count with search filters applied
        const total = await User.countDocuments(searchQuery);

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

    const { fullname, email, password, phone, role } = req.body;

    try {
        // Kiểm tra email đã tồn tại
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Kiểm tra định dạng phone
        if (
            phone &&
            !/^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(phone)
        ) {
            return res.status(400).json({ message: 'Invalid phone number format' });
        }

        // Nếu không có address, tạo user không có phone trong address
        user = new User({
            fullname,
            email,
            password,
            role: role || 'user',
            // Chỉ thêm address nếu có phone
            ...(phone && {
                address: [
                    {
                        phone: phone,
                        receiver: fullname, // Mặc định lấy tên người dùng
                        address: 'chưa được cập nhật', // Để trống địa chỉ nếu chưa có
                    },
                ],
            }),
        });

        await user.save();

        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(201).json(userResponse);
    } catch (error) {
        console.error('Error in createUser:', error);

        // Xử lý các lỗi validation của Mongoose
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(
                (err) => err.message
            );
            return res
                .status(400)
                .json({ message: 'Validation Error', errors: validationErrors });
        }

        res.status(500).json({ message: 'Server Error', error: error.message });
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

        const userOrders = await Order.find({ user_id: req.params.id });

        if (userOrders.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete user because they have ${userOrders.length} order(s)`
            });
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