const { validationResult } = require('express-validator');
const Voucher = require('../models/Voucher');
const Order = require('../models/Order');
const { removeUploadedFile } = require('../middlewares/uploadFile');
const path = require('path');
const fs = require('fs');

// Get vouchers with pagination and filter
exports.getVouchers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const name = req.query.name;

        let query = {};
        if (name) {
            query.name = { $regex: name, $options: 'i' };
        }

        const total = await Voucher.countDocuments(query);
        const vouchers = await Voucher.find(query)
            .select('-__v')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);
        // Format image URL
        const formattedVouchers = vouchers.map(voucher => {
            const voucherObj = voucher.toObject();
            if (voucherObj.img) {
                voucherObj.img = voucherObj.img.startsWith('https')
                    ? voucherObj.img
                    : `${process.env.DOMAIN}/images/${voucherObj.img}`;
            }
            return voucherObj;
        });

        res.json({
            success: true,
            data: {
                vouchers: formattedVouchers,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: limit
                }
            }
        });
    } catch (error) {
        console.error('Get vouchers error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching vouchers'
        });
    }
};

// Get single voucher
exports.getVoucherById = async (req, res) => {
    try {
        const voucher = await Voucher.findById(req.params.id).select('-__v');
        if (!voucher) {
            return res.status(404).json({
                success: false,
                message: 'Voucher not found'
            });
        }
        voucher.img.startsWith('https') ? voucher.img = voucher.img : voucher.img = `${process.env.DOMAIN}/images/${voucher.img}`

        res.json({ success: true, data: voucher });
    } catch (error) {
        console.error('Get voucher error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching voucher'
        });
    }
};

// Apply voucher
exports.applyVoucher = async (req, res) => {
    try {
        const { code, orderTotal } = req.body;

        if (!code || !orderTotal) {
            return res.status(400).json({
                success: false,
                message: 'Voucher code and order total are required'
            });
        }

        const voucher = await Voucher.findOne({ code });

        if (!voucher) {
            return res.status(404).json({
                success: false,
                message: 'Invalid voucher code'
            });
        }

        // Check if voucher is expired
        const currentDate = new Date();
        if (currentDate < voucher.start || currentDate > voucher.end) {
            return res.status(400).json({
                success: false,
                message: 'Voucher has expired or not yet active'
            });
        }

        // Check minimum order amount
        if (orderTotal < voucher.min_price) {
            return res.status(400).json({
                success: false,
                message: `Minimum order amount required is ${voucher.min_price}`
            });
        }

        // Check if voucher limit is reached
        if (voucher.limit <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Voucher usage limit has been reached'
            });
        }

        // Calculate discount amount
        const discountAmount = (orderTotal * voucher.discount_percent) / 100;
        const finalAmount = orderTotal - discountAmount;

        res.json({
            success: true,
            data: {
                discountAmount,
                finalAmount,
                discountPercent: voucher.discount_percent
            }
        });

    } catch (error) {
        console.error('Apply voucher error:', error);
        res.status(500).json({
            success: false,
            message: 'Error applying voucher'
        });
    }
};

// Create voucher (admin only)
exports.createVoucher = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.fileData) {
                await removeUploadedFile(req.fileData.fileId);
            }
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, code, discount_percent, start, end, limit, min_price } = req.body;

        // Handle image data from Google Drive upload
        const imageData = req.fileData ? {
            url: req.fileData.thumbnailLink,
            fileId: req.fileData.fileId
        } : null;

        const voucher = new Voucher({
            name,
            code,
            discount_percent,
            start,
            end,
            limit,
            min_price,
            img: imageData ? imageData.url : null,
            imgFileId: imageData ? imageData.fileId : null
        });

        await voucher.save();

        res.status(201).json({
            success: true,
            message: 'Voucher created successfully',
            data: voucher
        });

    } catch (error) {
        if (req.fileData) {
            await removeUploadedFile(req.fileData.fileId);
        }
        console.error('Create voucher error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating voucher'
        });
    }
};

// Update voucher (admin only)
exports.updateVoucher = async (req, res) => {
    try {
        const voucher = await Voucher.findById(req.params.id);
        if (!voucher) {
            if (req.fileData) {
                await removeUploadedFile(req.fileData.fileId);
            }
            return res.status(404).json({
                success: false,
                message: 'Voucher not found'
            });
        }

        // Update basic fields
        const fields = ['name', 'code', 'discount_percent', 'start', 'end', 'limit', 'min_price'];
        fields.forEach(field => {
            if (req.body[field] !== undefined) voucher[field] = req.body[field];
        });

        // Handle new image upload
        if (req.fileData) {
            // Remove old image from Google Drive if it exists
            if (voucher.imgFileId) {
                await removeUploadedFile(voucher.imgFileId);
            }

            // Update with new image data
            voucher.img = req.fileData.thumbnailLink;
            voucher.imgFileId = req.fileData.fileId;
        }

        await voucher.save();

        res.json({
            success: true,
            message: 'Voucher updated successfully',
            data: voucher
        });

    } catch (error) {
        if (req.fileData) {
            await removeUploadedFile(req.fileData.fileId);
        }
        console.error('Update voucher error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating voucher'
        });
    }
};

// Delete voucher (admin only)
exports.deleteVoucher = async (req, res) => {
    try {
        const voucher = await Voucher.findById(req.params.id);
        if (!voucher) {
            return res.status(404).json({
                success: false,
                message: 'Voucher not found'
            });
        }

        const existingOrders = await Order.findOne({ voucher_id: req.params.id });
        if (existingOrders) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete voucher as it has been used in existing orders'
            });
        }

        // Remove image from Google Drive if it exists
        if (voucher.imgFileId) {
            await removeUploadedFile(voucher.imgFileId);
        }

        await voucher.deleteOne();

        res.json({
            success: true,
            message: 'Voucher deleted successfully',
            data: { id: req.params.id }
        });

    } catch (error) {
        console.error('Delete voucher error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting voucher'
        });
    }
};