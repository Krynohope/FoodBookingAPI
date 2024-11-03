const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const authMiddleware = (requiredRole = null) => {
    return (req, res, next) => {

        const token = req.headers.cookie?.split(';')
            .find(cookie => cookie.trim().startsWith('access_token='))
            ?.split('=')[1];

        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        try {
            const decoded = jwt.verify(token, process.env.SECRET_KEY_ACCESS_TOKEN);
            req.user = decoded.user;

            if (requiredRole && req.user.role !== requiredRole) {
                return res.status(403).json({ message: 'Access forbidden: Insufficient permissions' });
            }

            next();
        } catch (err) {
            res.status(401).json({ message: 'Token is not valid' });
        }
    };
};

module.exports = authMiddleware;