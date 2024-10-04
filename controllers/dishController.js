const { validationResult } = require('express-validator');
const Dish = require('../models/Dish');
const Menu = require('../models/Menu');

// Lấy danh sách món ăn
exports.getDishes = async (req, res) => {
    try {
        const dishes = await Dish.find().populate('menu', 'name');
        res.json(dishes);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

exports.getDishesWithPagi = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const dishes = await Dish.find()
            .populate('menu', 'name')
            .skip(skip)
            .limit(limit)
            .lean();

        const totalDishes = await Dish.countDocuments();
        const totalPages = Math.ceil(totalDishes / limit);

        res.json({
            dishes,
            currentPage: page,
            totalPages,
            totalDishes,
            limit
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Failed to get dishes', error: error.message });
    }
}

// Lấy chi tiết một món ăn
exports.getDishById = async (req, res) => {
    try {
        const dish = await Dish.findById(req.params.id).populate('menu', 'name');
        if (!dish) return res.status(404).json({ message: 'Dish not found' });
        res.json(dish);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Tạo món ăn mới
exports.createDish = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { menu_id, name, description, price, image_url } = req.body;

    try {
        const menu = await Menu.findById(menu_id);
        if (!menu) return res.status(404).json({ message: 'Menu not found' });

        const dish = new Dish({
            menu: menu_id,
            name,
            description,
            price,
            image_url,
        });

        await dish.save();

        res.status(201).json({ message: 'Dish created successfully', dish });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Cập nhật món ăn
exports.updateDish = async (req, res) => {
    const { menu_id, name, description, price, image_url } = req.body;

    const dishFields = {};
    if (menu_id) dishFields.menu = menu_id;
    if (name) dishFields.name = name;
    if (description) dishFields.description = description;
    if (price) dishFields.price = price;
    if (image_url) dishFields.image_url = image_url;

    try {
        let dish = await Dish.findById(req.params.id);
        if (!dish) return res.status(404).json({ message: 'Dish not found' });

        if (menu_id) {
            const menu = await Menu.findById(menu_id);
            if (!menu) return res.status(404).json({ message: 'Menu not found' });
        }

        dish = await Dish.findByIdAndUpdate(
            req.params.id,
            { $set: dishFields },
            { new: true }
        ).populate('menu', 'name');

        res.json({ message: 'Dish updated successfully', dish });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Xóa món ăn
exports.deleteDish = async (req, res) => {
    try {
        let dish = await Dish.findById(req.params.id);
        if (!dish) return res.status(404).json({ message: 'Dish not found' });

        await Dish.findByIdAndRemove(req.params.id);

        res.json({ message: 'Dish removed' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};
