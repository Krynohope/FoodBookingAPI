const { validationResult } = require('express-validator');
const Payment_method = require('../models/Payment_method');
const Order = require('../models/Order');
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

        // Format image URL
        const formattedPaymentMethods = paymentMethods.map(method => {
            const methodObj = method.toObject();
            if (methodObj.img) {
                methodObj.img = methodObj.img.startsWith('https')
                    ? methodObj.img
                    : `${process.env.DOMAIN}/images/${methodObj.img}`;
            }
            return methodObj;
        });

        res.json({
            success: true,
            data: {
                paymentMethods: formattedPaymentMethods,
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
        paymentMethod.img.startsWith('https') ? paymentMethod.img = paymentMethod.img : paymentMethod.img = `${process.env.DOMAIN}/images/${paymentMethod.img}`

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
        // Validate request
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // If there's an uploaded file, remove it from Google Drive
            if (req.fileData) {
                await removeUploadedFile(req.fileData.fileId);
            }
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, type, description, status } = req.body;

        // Handle image data from Google Drive upload
        const imageData = req.fileData ? {
            url: req.fileData.thumbnailLink,
            fileId: req.fileData.fileId
        } : null;

        const paymentMethod = new Payment_method({
            name,
            type,
            description,
            status,
            img: imageData ? imageData.url : null,
            imgFileId: imageData ? imageData.fileId : null
        });

        await paymentMethod.save();

        res.status(201).json({
            success: true,
            message: 'Payment method created successfully',
            data: paymentMethod
        });

    } catch (error) {
        // If there's an error and a file was uploaded, remove it from Google Drive
        if (req.fileData) {
            await removeUploadedFile(req.fileData.fileId);
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
        const paymentMethod = await Payment_method.findById(req.params.id);
        if (!paymentMethod) {
            if (req.fileData) {
                await removeUploadedFile(req.fileData.fileId);
            }
            return res.status(404).json({
                success: false,
                message: 'Payment method not found'
            });
        }

        // Update basic fields
        if (req.body.name) paymentMethod.name = req.body.name;
        if (req.body.type) paymentMethod.type = req.body.type;
        if (req.body.description) paymentMethod.description = req.body.description;
        if (req.body.status) paymentMethod.status = req.body.status;

        // Handle new image upload
        if (req.fileData) {
            // Remove old image from Google Drive if it exists
            if (paymentMethod.imgFileId) {
                await removeUploadedFile(paymentMethod.imgFileId);
            }

            // Update with new image data
            paymentMethod.img = req.fileData.thumbnailLink;
            paymentMethod.imgFileId = req.fileData.fileId;
        }

        await paymentMethod.save();

        res.json({
            success: true,
            message: 'Payment method updated successfully',
            data: paymentMethod
        });

    } catch (error) {
        // Clean up uploaded file if there was an error
        if (req.fileData) {
            await removeUploadedFile(req.fileData.fileId);
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

        const existingOrders = await Order.findOne({ payment_method: req.params.id });
        if (existingOrders) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete payment method as it is being used in existing orders'
            });
        }

        // Remove image from Google Drive if it exists
        if (paymentMethod.imgFileId) {
            await removeUploadedFile(paymentMethod.imgFileId);
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