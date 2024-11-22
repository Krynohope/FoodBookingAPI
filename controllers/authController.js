const { validationResult } = require('express-validator');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

dotenv.config();

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendVerification = (email, code) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Xác thực tài khoản của bạn',
        html: `<p>Mã xác thực của bạn là: <b>${code}</b>.</p>
           <p>Mã này có hiệu lực trong <b>2 phút</b>.</p>`,
    };

    return transporter.sendMail(mailOptions);
};

const sendPasswordResetEmail = (email, token) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Đặt lại mật khẩu',
        html: `<p>Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng sử dụng liên kết sau để đặt lại mật khẩu: ${process.env.DOMAIN}/auth/resetPassword/${token}</p>
           <p>Liên kết này có hiệu lực trong <b>1 giờ</b>.</p>`,
    };

    return transporter.sendMail(mailOptions);
};

// Sign up
exports.register = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { fullname, email, password, phone, address } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'Email already exists' });

        user = new User({
            fullname,
            email,
            password,
            phone,
            address,
        });

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationCode = verificationCode;
        user.verificationCodeExpires = Date.now() + 2 * 60 * 1000;
        await user.save();

        await sendVerification(email, verificationCode);

        return res.status(201).json({ message: 'User registered successfully. Please check your email to verify your account.' });

    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Verify email
exports.verifyEmail = async (req, res) => {
    const { email, code } = req.body;

    try {
        const user = await User.findOne({
            email,
            verificationCode: code,
            verificationCodeExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired verification code' });
        }

        user.isVerified = true;
        user.verificationCode = undefined;
        user.verificationCodeExpires = undefined;
        await user.save();


        return res.json({ message: 'Email verified successfully' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Resend OTP 
exports.resendVerificationCode = async (req, res) => {
    try {
        const { email } = req.body;

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ msg: 'Email is already verified' });
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        const verificationCodeExpires = new Date(Date.now() + 2 * 60 * 1000);

        user.verificationCode = verificationCode;
        user.verificationCodeExpires = verificationCodeExpires;
        await User.findOneAndUpdate({ email: user.email }, { verificationCode: verificationCode, verificationCodeExpires: verificationCodeExpires })

        await sendVerification(user.email, verificationCode);

        return res.json({ msg: 'New verification code has been sent to your email' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};


// Signin
exports.login = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'User not found' });

        if (!user.isVerified) {
            return res.status(400).json({ message: 'Please verify your email before logging in' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(400).json({ message: 'Password does not match' });

        const payload = {
            user: {
                id: user.id,
                role: user.role,
            }
        };

        const token = jwt.sign(payload, process.env.SECRET_KEY_ACCESS_TOKEN, { expiresIn: '3h' });

        const cookieOptions = process.env.NODE_ENV === 'production' ? {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/'
        } :
            {
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000,
                path: '/'
            }
        res.cookie('access_token', token, cookieOptions);

        return res.json({ token, role: user.role });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

exports.logout = async (req, res) => {
    try {
        const cookieOptions = process.env.NODE_ENV === 'production' ? {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'Strict' : 'Lax',
            path: '/'
        } :
            {
                httpOnly: true,
                path: '/'
            }
        res.clearCookie('access_token', cookieOptions);

        res.json({ msg: 'Logged out successfully' });
    } catch (err) {
        console.error('Logout error:', err.message);
        res.status(500).send('Server error');
    }
};

// Forgot password
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        await user.save();
        await sendPasswordResetEmail(email, resetToken);

        res.json({ message: 'Password reset email sent' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

// Reset password
exports.resetPassword = async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        const user = await User.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired password reset token' });
        }

        user.password = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.json({ message: 'Password reset successful' });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Server Error');
    }
};

//Change password
exports.changePassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword, verificationCode } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (!verificationCode || !user.verificationCode) {

            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Current password is incorrect' });
            }

            const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();

            await User.findOneAndUpdate(
                { _id: req.user.id },
                {
                    verificationCode: newVerificationCode,
                }
            );

            await sendVerification(user.email, newVerificationCode);

            return res.status(200).json({
                message: 'Verification code has been sent to your email'
            });
        }

        if (user.verificationCode != verificationCode) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        user.verificationCode = undefined;
        user.password = newPassword;
        await user.save();

        return res.status(200).json({
            message: 'Change password successfully !'
        });
    } catch (error) {
        console.error('Error in changePassword:', error.message);
        res.status(500).json({ message: 'Server Error' });
    }
};