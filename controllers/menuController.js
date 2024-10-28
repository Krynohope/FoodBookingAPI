const { validationResult } = require('express-validator');
const Menu = require('../models/Menu');
const Category = require('../models/Category');
const dotenv = require('dotenv');


// Get menu items with pagi
exports.getMenuItems = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const menuItems = await Menu.find()
            .populate('category', 'name')
            .skip(skip)
            .limit(limit)
            .lean();

        const totalMenuItems = await Menu.countDocuments();
        const totalPages = Math.ceil(totalMenuItems / limit);

        res.json({
            menuItems,
            currentPage: page,
            totalPages,
            totalMenuItems,
            limit
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

exports.createMenuItem = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        if (req.file) {
            removeUploadedFile(req.file.path);
        }
        return res.status(400).json({ errors: errors.array() });
    }

    const { category_id, name, description, price, variant } = req.body;

    try {
        const category = await Category.findById(category_id);
        if (!category) {
            if (req.file) {
                removeUploadedFile(req.file.path);
            }
            return res.status(404).json({ message: 'Category not found' });
        }

        const menuItemData = {
            category: category_id,
            name,
            description,
            price,
            image: req.file ? `${process.env.DOMAIN}/images/menu/${req.file.filename}` : undefined,
        };

        if (variant && variant.size && variant.price) {
            menuItemData.variant = {
                size: variant.size,
                price: variant.price
            };
        }

        const menuItem = new Menu(menuItemData);
        await menuItem.save();

        res.status(201).json({ message: 'Menu item created successfully', menuItem });
    } catch (error) {
        if (req.file) {
            removeUploadedFile(req.file.path);
        }
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Update menu item 
exports.updateMenuItem = async (req, res) => {
    const { category_id, name, description, price, variant } = req.body;

    const menuFields = {};
    if (category_id) menuFields.category = category_id;
    if (name) menuFields.name = name;
    if (description) menuFields.description = description;
    if (price) menuFields.price = price;
    if (req.file) {
        menuFields.image = `${process.env.DOMAIN}/images/menu/${req.file.filename}`;
    }

    if (variant === null) {
        menuFields.variant = undefined;
    } else if (variant && variant.size && variant.price) {
        menuFields.variant = {
            size: variant.size,
            price: variant.price
        };
    }

    try {
        let menuItem = await Menu.findById(req.params.id);
        if (!menuItem) {
            if (req.file) {
                removeUploadedFile(req.file.path);
            }
            return res.status(404).json({ message: 'Menu item not found' });
        }

        if (category_id) {
            const category = await Category.findById(category_id);
            if (!category) {
                if (req.file) {
                    removeUploadedFile(req.file.path);
                }
                return res.status(404).json({ message: 'Category not found' });
            }
        }

        if (req.file && menuItem.image) {
            const oldImagePath = path.join(__dirname, '..', 'public', menuItem.image);
            removeUploadedFile(oldImagePath);
        }

        menuItem = await Menu.findByIdAndUpdate(
            req.params.id,
            { $set: menuFields },
            { new: true }
        ).populate('category', 'name');

        res.json({ message: 'Menu item updated successfully', menuItem });
    } catch (error) {
        if (req.file) {
            removeUploadedFile(req.file.path);
        }
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Delete menu item 
exports.deleteMenuItem = async (req, res) => {
    try {
        let menuItem = await Menu.findById(req.params.id);
        if (!menuItem) {
            return res.status(404).json({ message: 'Menu item not found' });
        }

        if (menuItem.image) {
            const imagePath = path.join(__dirname, '..', 'public', menuItem.image);
            removeUploadedFile(imagePath);
        }

        await Menu.findByIdAndRemove(req.params.id);

        res.json({ message: 'Menu item removed' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};