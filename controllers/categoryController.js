const { validationResult } = require('express-validator');
const Category = require('../models/Category');
const { removeUploadedFile } = require('../middlewares/uploadFile');
const path = require('path');
const fs = require('fs');

// Get categories with name filter
exports.getCategories = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const name = req.query.name;

        let query = {};
        if (name) {
            query.name = { $regex: name, $options: 'i' };
        }

        const total = await Category.countDocuments(query);
        const categories = await Category.find(query)
            .select('-__v')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        res.json({
            success: true,
            data: {
                categories,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: limit
                }
            }
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching categories'
        });
    }
};

// Get single category
exports.getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id).select('-__v');
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }
        res.json({ success: true, data: category });
    } catch (error) {
        console.error('Get category error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching category'
        });
    }
};

// Create category
exports.createCategory = async (req, res) => {
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

        const { name, description } = req.body;
        const imgPath = req.file ? `${process.env.DOMAIN}/images/${req.file.filename}` : null;

        const category = new Category({
            name,
            description,
            img: imgPath
        });

        await category.save();

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: category
        });

    } catch (error) {
        if (req.file) {
            removeUploadedFile(req.file.path);
        }
        console.error('Create category error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating category'
        });
    }
};

// Update category
exports.updateCategory = async (req, res) => {
    try {
        let category = await Category.findById(req.params.id);
        if (!category) {
            if (req.file) {
                removeUploadedFile(req.file.path);
            }
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        const updateData = {};
        if (req.body.name) updateData.name = req.body.name;
        if (req.body.description) updateData.description = req.body.description;

        if (req.file) {
            // Remove old image if exists
            if (category.img) {
                const oldPath = path.join('public', category.img);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            updateData.img = `${process.env.DOMAIN}/images/${req.file.filename}`;
        }

        category = await Category.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        res.json({
            success: true,
            message: 'Category updated successfully',
            data: category
        });

    } catch (error) {
        if (req.file) {
            removeUploadedFile(req.file.path);
        }
        console.error('Update category error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating category'
        });
    }
};

// Delete category
exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Remove image if exists
        if (category.img) {
            const imagePath = path.join('public', category.img);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await category.deleteOne();

        res.json({
            success: true,
            message: 'Category deleted successfully',
            data: { id: req.params.id }
        });

    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting category'
        });
    }
};