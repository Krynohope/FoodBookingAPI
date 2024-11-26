const { validationResult } = require('express-validator');
const Menu = require('../models/Menu');
const Category = require('../models/Category');
const { removeUploadedFile } = require('../middlewares/uploadFile');

const createVietnameseRegex = (keyword) => {
    const vietnameseCharMap = {
        a: "[aáàạảãâấầậẩẫăắằặẳẵ]",
        d: "[dđ]",
        e: "[eéèẹẻẽêếềệểễ]",
        i: "[iíìịỉĩ]",
        o: "[oóòọỏõôốồộổỗơớờợởỡ]",
        u: "[uúùụủũưứừựửữ]",
        y: "[yýỳỵỷỹ]",
    };

    // Thay thế từng ký tự bằng regex tương ứng
    return keyword
        .toLowerCase()
        .split("")
        .map((char) => vietnameseCharMap[char] || char)
        .join("");
};

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
        if (req.query.category) {
            const category = await Category.findById(req.query.category);
            if (!category) {
                return res.status(404).json({ message: 'Category not found' });
            }
            filter.category = req.query.category;
        }

        // Add filter by name
        if (req.query.name) {
            const searchQuery = createVietnameseRegex(req.query.name);
            filter.name = { $regex: searchQuery, $options: 'i' };
        }
        // Add price range filter
        if (req.query.minPrice || req.query.maxPrice) {
            filter.$or = [
                { price: { $exists: true, $gte: parseFloat(req.query.minPrice || 0), $lte: parseFloat(req.query.maxPrice || Infinity) } },
                { 'variant.price': { $exists: true, $gte: parseFloat(req.query.minPrice || 0), $lte: parseFloat(req.query.maxPrice || Infinity) } }
            ];
        }

        // Add sort option
        let sortOption = {};
        if (req.query.sort) {
            switch (req.query.sort.toLowerCase()) {
                case 'price_asc':
                    sortOption = { 'variant.price': 1, price: 1 };
                    break;
                case 'price_desc':
                    sortOption = { 'variant.price': -1, price: -1 };
                    break;
                default:
                    sortOption = {};
            }
        }

        const menuItems = await Menu.find(filter)
            .populate('category', 'name')
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        // Format image URLs
        const formattedMenuItems = menuItems.map(item => {
            const formatted = { ...item };

            if (formatted.img && !formatted.img.startsWith('https')) {
                formatted.img = `${process.env.DOMAIN}/images/${formatted.img}`;
            }

            return formatted;
        });

        const totalMenuItems = await Menu.countDocuments(filter);
        const totalPages = Math.ceil(totalMenuItems / limit);

        res.json({
            menuItems: formattedMenuItems,
            currentPage: page,
            totalPages,
            totalMenuItems,
            limit,
            filters: {
                category: req.query.category,
                minPrice: req.query.minPrice,
                maxPrice: req.query.maxPrice,
                sort: req.query.sort
            }
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Failed to get menu items', error: error.message });
    }
};
// Get menu item by ID
exports.getMenuItemById = async (req, res) => {
    try {
        const menuItem = await Menu.findById(req.params.id).populate('category', 'name');
        if (!menuItem) return res.status(404).json({ message: 'Menu item not found' });
        menuItem.img.startsWith('https') ? menuItem.img = menuItem.img : menuItem.img = `${process.env.DOMAIN}/images/${menuItem.img}`
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
            if (req.fileData) {
                await removeUploadedFile(req.fileData.fileId);
            }
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { category, name, description, price, variant } = req.body;

        // Parse variant if provided
        let parsedVariant = [];
        if (variant) {
            try {
                parsedVariant = JSON.parse(variant);
            } catch (e) {
                console.error('Error parsing variant:', e);
                if (req.fileData) {
                    await removeUploadedFile(req.fileData.fileId);
                }
                return res.status(400).json({
                    success: false,
                    message: 'Invalid variant format'
                });
            }
        }

        // Verify category exists
        const cate = await Category.findById(category);
        if (!cate) {
            if (req.fileData) {
                await removeUploadedFile(req.fileData.fileId);
            }
            return res.status(404).json({
                success: false,
                message: 'Category not found'
            });
        }

        // Create menu item data
        const menuItemData = {
            category,
            name,
            description,
            price,
            variant: parsedVariant
        };

        // Add image data if uploaded
        if (req.fileData) {
            menuItemData.img = req.fileData.downloadLink;
            menuItemData.imgFileId = req.fileData.fileId;
        }

        const menuItem = new Menu(menuItemData);
        await menuItem.save();

        res.status(201).json({
            success: true,
            message: 'Menu item created successfully',
            data: menuItem
        });

    } catch (error) {
        if (req.fileData) {
            await removeUploadedFile(req.fileData.fileId);
        }
        console.error('Create menu item error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating menu item',
            error: error.message
        });
    }
};


// Update menu item
exports.updateMenuItem = async (req, res) => {
    try {
        const menuItem = await Menu.findById(req.params.id);
        if (!menuItem) {
            if (req.fileData) {
                await removeUploadedFile(req.fileData.fileId);
            }
            return res.status(404).json({
                success: false,
                message: 'Menu item not found'
            });
        }

        const { category, name, description, price, quantity, variant } = req.body;
        const updateData = {};

        // Verify category if provided
        if (category) {
            const cate = await Category.findById(category);
            if (!cate) {
                if (req.fileData) {
                    await removeUploadedFile(req.fileData.fileId);
                }
                return res.status(404).json({
                    success: false,
                    message: 'Category not found'
                });
            }
            updateData.category = category;
        }

        // Update basic fields
        if (name) updateData.name = name;
        if (description) updateData.description = description;
        if (price) updateData.price = price;
        if (quantity) updateData.quantity = quantity;

        // Handle image update
        if (req.fileData) {
            // Remove old image from Google Drive if exists
            if (menuItem.imgFileId) {
                await removeUploadedFile(menuItem.imgFileId);
            }
            updateData.img = req.fileData.downloadLink;
            updateData.imgFileId = req.fileData.fileId;
        }

        // Handle variant update
        if (variant === null) {
            updateData.variant = undefined;
        } else if (variant) {
            try {
                updateData.variant = typeof variant === 'string' ? JSON.parse(variant) : variant;
            } catch (error) {
                console.error('Error parsing variant:', error);
                if (req.fileData) {
                    await removeUploadedFile(req.fileData.fileId);
                }
                return res.status(400).json({
                    success: false,
                    message: 'Invalid variant format'
                });
            }
        }

        // Update menu item
        const updatedMenuItem = await Menu.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('category', 'name');

        res.json({
            success: true,
            message: 'Menu item updated successfully',
            data: updatedMenuItem
        });

    } catch (error) {
        if (req.fileData) {
            await removeUploadedFile(req.fileData.fileId);
        }
        console.error('Update menu item error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating menu item',
            error: error.message
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

        // Remove image from Google Drive if exists
        if (menuItem.imgFileId) {
            await removeUploadedFile(menuItem.imgFileId);
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
            message: 'Error deleting menu item',
            error: error.message
        });
    }
};