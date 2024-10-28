const { validationResult } = require('express-validator');
const Category = require('../models/Category');

// Get categories with pagination
exports.getCategories = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const total = await Category.countDocuments();
        const categories = await Category.find()
            .select('-__v')
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            categories,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: limit
            }
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Server Error' });
    }
};

// Get category by ID
exports.getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id).select('-__v');
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.json(category);
    } catch (error) {
        console.error(error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid category ID' });
        }
        res.status(500).json({ message: 'Server Error' });
    }
};

// Create new category
exports.createCategory = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, img } = req.body;

    try {
        const category = new Category({
            name,
            description,
            img
        });

        await category.save();

        res.status(201).json({
            message: 'Category created successfully',
            category
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Server Error' });
    }
};

// Update category
exports.updateCategory = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, img } = req.body;

    try {
        let category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        const updateFields = {
            name,
            description,
            img,
        };

        // Only include fields that are provided in the request
        Object.keys(updateFields).forEach(key =>
            updateFields[key] === undefined && delete updateFields[key]
        );

        category = await Category.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true, runValidators: true }
        ).select('-__v');

        res.json({
            message: 'Category updated successfully',
            category
        });
    } catch (error) {
        console.error(error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid category ID' });
        }
        res.status(500).json({ message: 'Server Error' });
    }
};

// Delete category
exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }

        await Category.findByIdAndDelete(req.params.id);

        res.json({
            message: 'Category deleted successfully',
            category_id: req.params.id
        });
    } catch (error) {
        console.error(error.message);
        if (error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid category ID' });
        }
        res.status(500).json({ message: 'Server Error' });
    }
};