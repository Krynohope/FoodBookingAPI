const { validationResult } = require('express-validator');
const Menu = require('../models/Menu');

// Lấy danh sách menu
exports.getMenus = async (req, res) => {
    try {
        const menus = await Menu.find();
        res.json(menus);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Lấy chi tiết một menu
exports.getMenuById = async (req, res) => {
    try {
        const menu = await Menu.findById(req.params.id);
        if (!menu) return res.status(404).json({ message: 'Menu not found' });
        res.json(menu);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Tạo menu mới
exports.createMenu = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;

    try {
        let menu = new Menu({
            name,
            description,
        });

        await menu.save();

        res.status(201).json({ message: 'Menu created successfully', menu });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Cập nhật menu
exports.updateMenu = async (req, res) => {
    const { name, description } = req.body;

    const menuFields = {};
    if (name) menuFields.name = name;
    if (description) menuFields.description = description;

    try {
        let menu = await Menu.findById(req.params.id);
        if (!menu) return res.status(404).json({ message: 'Menu not found' });

        menu = await Menu.findByIdAndUpdate(
            req.params.id,
            { $set: menuFields },
            { new: true }
        );

        res.json({ message: 'Menu updated successfully', menu });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Xóa menu
exports.deleteMenu = async (req, res) => {
    try {
        let menu = await Menu.findById(req.params.id);
        if (!menu) return res.status(404).json({ message: 'Menu not found' });

        await Menu.findByIdAndRemove(req.params.id);

        res.json({ message: 'Menu removed' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};
