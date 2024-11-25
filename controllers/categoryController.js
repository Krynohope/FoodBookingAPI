const { validationResult } = require('express-validator');
const Category = require('../models/Category');
const { removeUploadedFile } = require('../middlewares/uploadFile');

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
        // Format image URLs in the response
        const formattedCategories = categories.map(category => {
            const categoryObj = category.toObject();
            if (categoryObj.img) {
                categoryObj.img = categoryObj.img.startsWith('https')
                    ? categoryObj.img
                    : `${process.env.DOMAIN}/images/${categoryObj.img}`;
            }
            return categoryObj;
        });

        res.json({
            success: true,
            data: {
                categories: formattedCategories,
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
        category.img.startsWith('https') ? category.img = category.img : category.img = `${process.env.DOMAIN}/images/${category.img}`

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
        // Validate request body
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // If there was a file uploaded, remove it from Google Drive
            if (req.fileData) {
                await removeUploadedFile(req.fileData.fileId);
            }
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, description } = req.body;

        // Handle image data from Google Drive upload
        const imageData = req.fileData ? {
            url: req.fileData.downloadLink,
            fileId: req.fileData.fileId
        } : null;

        const category = new Category({
            name,
            description,
            img: imageData ? imageData.url : null,
            imgFileId: imageData ? imageData.fileId : null
        });

        await category.save();

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            data: category
        });

    } catch (error) {
        // If there was an error and a file was uploaded, clean it up
        if (req.fileData) {
            await removeUploadedFile(req.fileData.fileId);
        }
        console.error('Create category error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating category',
            error: error.message
        });
    }
};

// Update category
exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;

        // Find existing category
        const category = await Category.findById(id);
        if (!category) {
            if (req.fileData) {
                await removeUploadedFile(req.fileData.fileId);
            }
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Update fields
        if (name) category.name = name;
        if (description) category.description = description;

        // Handle new image upload
        if (req.fileData) {
            // Remove old image from Google Drive if it exists
            if (category.imgFileId) {
                await removeUploadedFile(category.imgFileId);
            }

            // Update with new image data
            category.img = req.fileData.downloadLink;
            category.imgFileId = req.fileData.fileId;
        }

        await category.save();

        res.json({
            success: true,
            message: 'Category updated successfully',
            data: category
        });

    } catch (error) {
        // Clean up uploaded file if there was an error
        if (req.fileData) {
            await removeUploadedFile(req.fileData.fileId);
        }
        console.error('Update category error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating category',
            error: error.message
        });
    }
};

// Delete category
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Remove image from Google Drive if it exists
        if (category.imgFileId) {
            await removeUploadedFile(category.imgFileId);
        }

        await category.deleteOne();

        res.json({
            success: true,
            message: 'Category deleted successfully'
        });

    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting category',
            error: error.message
        });
    }
};