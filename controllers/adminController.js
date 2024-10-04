const User = require('../models/User');
const Menu = require('../models/Menu');
const Dish = require('../models/Dish');
const Order = require('../models/Order');

// --- Quản Lý Người Dùng ---

// Lấy danh sách người dùng
exports.getUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Tạo người dùng mới
exports.createUser = async (req, res) => {
    const { full_name, email, password, phone_number, address, role } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'Email already exists' });

        user = new User({
            full_name,
            email,
            password,
            phone_number,
            address,
            role,
        });

        await user.save();

        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Cập nhật thông tin người dùng
exports.updateUser = async (req, res) => {
    const { full_name, email, phone_number, address, role } = req.body;

    const userFields = {};
    if (full_name) userFields.full_name = full_name;
    if (email) userFields.email = email;
    if (phone_number) userFields.phone_number = phone_number;
    if (address) userFields.address = address;
    if (role) userFields.role = role;

    try {
        let user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: userFields },
            { new: true }
        ).select('-password');

        res.json(user);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Xóa người dùng
exports.deleteUser = async (req, res) => {
    try {
        let user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        await User.findByIdAndRemove(req.params.id);

        res.json({ message: 'User removed' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};



// --- Quản Lý Menu ---

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

// Tạo menu mới
exports.createMenu = async (req, res) => {
    const { name, description } = req.body;

    try {
        let menu = new Menu({
            name,
            description,
        });

        await menu.save();

        res.status(201).json({ message: 'Menu created successfully' });
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

        res.json(menu);
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



// --- Quản Lý Món Ăn ---

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

// Tạo món ăn mới
exports.createDish = async (req, res) => {
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

        res.status(201).json({ message: 'Dish created successfully' });
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
        );

        res.json(dish);
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

// --- Quản Lý Đơn Hàng ---

// Lấy danh sách đơn hàng
exports.getOrders = async (req, res) => {
    try {
        const orders = await Order.find().populate('user', 'full_name email').populate({
            path: 'order_items',
            populate: {
                path: 'dish',
                select: 'name price',
            },
        });
        res.json(orders);
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Cập nhật trạng thái đơn hàng
exports.updateOrderStatus = async (req, res) => {
    const { status } = req.body;

    const validStatuses = ['Pending', 'Processing', 'Completed', 'Canceled'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
    }

    try {
        let order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        order.status = status;
        await order.save();

        res.json({ message: 'Order status updated successfully', order });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};
