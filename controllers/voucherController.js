const { validationResult } = require('express-validator');
const Voucher = require('../models/Voucher');
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

        res.json({
            success: true,
            data: {
                vouchers,
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
        if (orderTotal < voucher.min_order) {
            return res.status(400).json({
                success: false,
                message: `Minimum order amount required is ${voucher.min_order}`
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
            if (req.file) {
                removeUploadedFile(req.file.path);
            }
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, code, discount_percent, start, end, limit, min_order } = req.body;
        const imgPath = req.file ? `${req.file.filename}` : null;

        const voucher = new Voucher({
            name,
            code,
            discount_percent,
            start,
            end,
            limit,
            min_order,
            img: imgPath
        });

        await voucher.save();

        res.status(201).json({
            success: true,
            message: 'Voucher created successfully',
            data: voucher
        });

    } catch (error) {
        if (req.file) {
            removeUploadedFile(req.file.path);
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
        let voucher = await Voucher.findById(req.params.id);
        if (!voucher) {
            if (req.file) {
                removeUploadedFile(req.file.path);
            }
            return res.status(404).json({
                success: false,
                message: 'Voucher not found'
            });
        }

        const updateData = {};
        const fields = ['name', 'code', 'discount_percent', 'start', 'end', 'limit', 'min_order'];
        fields.forEach(field => {
            if (req.body[field] !== undefined) updateData[field] = req.body[field];
        });

        if (req.file) {
            // Remove old image if exists
            if (voucher.img) {
                const oldPath = path.join('public', voucher.img);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            updateData.img = `${req.file.filename}`;
        }

        voucher = await Voucher.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            message: 'Voucher updated successfully',
            data: voucher
        });

    } catch (error) {
        if (req.file) {
            removeUploadedFile(req.file.path);
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

        // Remove image if exists
        if (voucher.img) {
            const imagePath = path.join('public', voucher.img);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
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