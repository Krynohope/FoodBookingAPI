const { validationResult } = require('express-validator');
const Payment_method = require('../models/Payment_method');
const { removeUploadedFile } = require('../middlewares/uploadFile');
const path = require('path');
const fs = require('fs');

// Get payment methods with filters and pagination
exports.getPaymentMethods = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { name, type, status } = req.query;

        let query = {};
        if (name) {
            query.name = { $regex: name, $options: 'i' };
        }
        if (type) {
            query.type = { $regex: type, $options: 'i' };
        }
        if (status) {
            query.status = status;
        }

        const total = await Payment_method.countDocuments(query);
        const paymentMethods = await Payment_method.find(query)
            .select('-__v')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            success: true,
            data: {
                paymentMethods,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: limit
                }
            }
        });
    } catch (error) {
        console.error('Get payment methods error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching payment methods'
        });
    }
};

// Get single payment method
exports.getPaymentMethodById = async (req, res) => {
    try {
        const paymentMethod = await Payment_method.findById(req.params.id).select('-__v');
        if (!paymentMethod) {
            return res.status(404).json({
                success: false,
                message: 'Payment method not found'
            });
        }
        res.json({ success: true, data: paymentMethod });
    } catch (error) {
        console.error('Get payment method error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching payment method'
        });
    }
};

// Create payment method
exports.createPaymentMethod = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.file) {
                removeUploadedFile(req.file.path);
            }
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, type, description, status } = req.body;
        const imgPath = req.file ? `${req.file.filename}` : null;

        const paymentMethod = new Payment_method({
            name,
            type,
            description,
            status,
            img: imgPath
        });

        await paymentMethod.save();

        res.status(201).json({
            success: true,
            message: 'Payment method created successfully',
            data: paymentMethod
        });

    } catch (error) {
        if (req.file) {
            removeUploadedFile(req.file.path);
        }
        console.error('Create payment method error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating payment method'
        });
    }
};

// Update payment method
exports.updatePaymentMethod = async (req, res) => {
    try {
        let paymentMethod = await Payment_method.findById(req.params.id);
        if (!paymentMethod) {
            if (req.file) {
                removeUploadedFile(req.file.path);
            }
            return res.status(404).json({
                success: false,
                message: 'Payment method not found'
            });
        }

        const updateData = {};
        if (req.body.name) updateData.name = req.body.name;
        if (req.body.type) updateData.type = req.body.type;
        if (req.body.description) updateData.description = req.body.description;
        if (req.body.status) updateData.status = req.body.status;

        if (req.file) {
            // Remove old image if exists
            if (paymentMethod.img) {
                const oldPath = path.join('public', paymentMethod.img);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            updateData.img = `/${req.file.filename}`;
        }

        paymentMethod = await Payment_method.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            message: 'Payment method updated successfully',
            data: paymentMethod
        });

    } catch (error) {
        if (req.file) {
            removeUploadedFile(req.file.path);
        }
        console.error('Update payment method error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating payment method'
        });
    }
};

// Delete payment method
exports.deletePaymentMethod = async (req, res) => {
    try {
        const paymentMethod = await Payment_method.findById(req.params.id);
        if (!paymentMethod) {
            return res.status(404).json({
                success: false,
                message: 'Payment method not found'
            });
        }

        // Remove image if exists
        if (paymentMethod.img) {
            const imagePath = path.join('public', paymentMethod.img);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await paymentMethod.deleteOne();

        res.json({
            success: true,
            message: 'Payment method deleted successfully',
            data: { id: req.params.id }
        });

    } catch (error) {
        console.error('Delete payment method error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting payment method'
        });
    }
};