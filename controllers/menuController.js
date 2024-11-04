const { validationResult } = require('express-validator');
const Menu = require('../models/Menu');
const Category = require('../models/Category');
const { removeUploadedFile } = require('../middlewares/uploadFile');
const path = require('path');
const fs = require('fs');

// Get menu items with optional filters and pagination
exports.getMenuItems = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filter = {};

        // Add category filter
        if (req.query.category_id) {

            const category = await Category.findById(req.query.category_id);
            if (!category) {
                return res.status(404).json({ message: 'Category not found' });
            }
            filter.category = req.query.category_id;
        }

        // Add  filter by name
        if (req.query.name) {
            filter.name = { $regex: req.query.name, $options: 'i' };
        }

        // Add  filter by price sort
        let sortOption = {};
        if (req.query.sort) {
            switch (req.query.sort.toLowerCase()) {
                case 'price_asc':
                    sortOption = { price: 1 };
                    break;
                case 'price_desc':
                    sortOption = { price: -1 };
                    break;
                default:
                    sortOption = {};
            }
        }

        // Add price range filter 
        if (req.query.minPrice || req.query.maxPrice) {
            filter.price = {};
            if (req.query.minPrice) filter.price.$gte = parseFloat(req.query.minPrice);
            if (req.query.maxPrice) filter.price.$lte = parseFloat(req.query.maxPrice);
        }

        const menuItems = await Menu.find(filter)
            .populate('category', 'name')
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        const totalMenuItems = await Menu.countDocuments(filter);
        const totalPages = Math.ceil(totalMenuItems / limit);

        res.json({
            menuItems,
            currentPage: page,
            totalPages,
            totalMenuItems,
            limit,

            filters: {
                category: req.query.category_id,
                minPrice: req.query.minPrice,
                maxPrice: req.query.maxPrice,
                sort: req.query.sort
            }
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Failed to get menu items', error: error.message });
    }
}

// Get menu item by ID
exports.getMenuItemById = async (req, res) => {
    try {
        const menuItem = await Menu.findById(req.params.id).populate('category', 'name');
        if (!menuItem) return res.status(404).json({ message: 'Menu item not found' });
        res.json(menuItem);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};


//Create menu item
exports.createMenuItem = async (req, res) => {
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

        const { category, name, description, price, variant } = req.body;

        const cate = await Category.findById(category);
        if (!cate) {
            if (req.file) {
                removeUploadedFile(req.file.path);
            }
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        const menuItemData = {
            category,
            name,
            description,
            price
        };

        if (req.file) {
            menuItemData.img = `${process.env.DOMAIN}/images/${req.file.filename}`;
        }

        if (variant && variant.size && variant.price) {
            menuItemData.variant = {
                size: variant.size,
                price: variant.price
            };
        }

        const menuItem = new Menu(menuItemData);
        await menuItem.save();

        res.status(201).json({
            success: true,
            message: 'Menu item created successfully',
            data: menuItem
        });
    } catch (error) {
        if (req.file) {
            removeUploadedFile(req.file.path);
        }
        console.error('Create menu item error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating menu item'
        });
    }
};

// Update menu item 
exports.updateMenuItem = async (req, res) => {
    try {
        let menuItem = await Menu.findById(req.params.id);
        if (!menuItem) {
            if (req.file) {
                removeUploadedFile(req.file.path);
            }
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }

        const { category, name, description, price, quantity, variant } = req.body;
        const updateData = {};

        if (category) {

            const cate = await Category.findById(category);
            if (!cate) {
                if (req.file) {
                    removeUploadedFile(req.file.path);
                }
                return res.status(404).json({
                    success: false,
                    message: 'Category not found'
                });
            }
            updateData.category = category;
        }

        if (name) updateData.name = name;
        if (description) updateData.description = description;
        if (price) updateData.price = price;
        if (quantity) updateData.quantity = quantity;

        if (req.file) {
            // Remove old image if exists
            if (menuItem.img) {
                const oldPath = path.join('public', menuItem.img);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            updateData.img = `${process.env.DOMAIN}/images/${req.file.filename}`;
        }

        if (variant === null) {
            updateData.variant = undefined;
        } else if (variant && variant.size && variant.price) {
            updateData.variant = {
                size: variant.size,
                price: variant.price
            };
        }

        menuItem = await Menu.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('category', 'name');

        res.json({
            success: true,
            message: 'Menu item updated successfully',
            data: menuItem
        });
    } catch (error) {
        if (req.file) {
            removeUploadedFile(req.file.path);
        }
        console.error('Update menu item error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating menu item'
        });
    }
};

// Delete menu item 
exports.deleteMenuItem = async (req, res) => {
    try {
        const menuItem = await Menu.findById(req.params.id);
        if (!menuItem) {
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }

        // Remove image if exists
        if (menuItem.img) {
            const imagePath = path.join('public', menuItem.img);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await menuItem.deleteOne();

        res.json({
            success: true,
            message: 'Menu item deleted successfully',
            data: { id: req.params.id }
        });
    } catch (error) {
        console.error('Delete menu item error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting menu item'
        });
    }
};