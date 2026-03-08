import User from '../models/User.js';
import LoginHistory from '../models/LoginHistory.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const generateToken = (id, rememberMe) => {
    const expiresIn = rememberMe ? '30d' : '1d';
    return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
        expiresIn,
    });
};

export const checkEmail = async (req, res) => {
    const { email } = req.body;
    try {
        const user = await User.findOne({ email });
        res.json({ exists: !!user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const registerUser = async (req, res) => {
    const { username, email, password, role } = req.body;
    const AUTHORIZED_ADMIN = 'varunkumarj23062006@gmail.com';

    try {
        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const usernameExists = await User.findOne({ username });
        if (usernameExists) {
            return res.status(400).json({ message: 'Username is already taken' });
        }

        const user = await User.create({
            username,
            email,
            password,
            // SECURITY: Only the authorized email can EVER register as admin
            role: (email === AUTHORIZED_ADMIN) ? 'admin' : 'user',
        });

        if (user) {
            // Log this initial registration/login event
            await LoginHistory.create({
                userId: user._id,
                email: user.email,
                role: user.role
            });

            res.status(201).json({
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, false),
            });
        } else {
            res.status(400).json({ message: 'Invalid user data' });
        }
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }
        res.status(500).json({ message: error.message });
    }
};

import { sendSecurityAlert } from '../utils/securityMonitor.js';

export const authUser = async (req, res) => {
    const { email, password, rememberMe } = req.body;
    const AUTHORIZED_ADMIN = 'varunkumarj23062006@gmail.com';

    try {
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {
            // STRICT SECURITY: Only the owner can be admin
            if (user.email === AUTHORIZED_ADMIN) {
                if (user.role !== 'admin') {
                    user.role = 'admin';
                    await user.save();
                }
            } else if (user.role === 'admin') {
                // SECURITY ENFORCEMENT: Demote unauthorized admins
                user.role = 'user';
                await user.save();
                await sendSecurityAlert('UNAUTHORIZED_ADMIN_DEMOTED', {
                    email: user.email,
                    message: `The user ${user.email} was found with unauthorized 'admin' role and has been demoted by the security engine.`
                });
            }

            // Log this login event for Admin auditing
            await LoginHistory.create({
                userId: user._id,
                email: user.email,
                role: user.role
            });

            res.json({
                _id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                token: generateToken(user._id, rememberMe),
            });
        } else {
            // Check if someone is trying to brute force the admin account
            if (email === AUTHORIZED_ADMIN) {
                await sendSecurityAlert('FAILED_ADMIN_LOGIN', {
                    email: email,
                    message: `FAILED login attempt for the System Owner account. Potential brute force attempt.`,
                    source: 'Auth Gate'
                });
            }
            res.status(401).json({ message: 'Invalid email or password' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User with that email does not exist.' });
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

        await user.save();

        console.log(`Password reset link: http://localhost:5173/reset-password/${resetToken}`);
        res.status(200).json({ message: 'Password reset link generated. Check console for the link in this demo.', resetToken });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const resetPassword = async (req, res) => {
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    try {
        const user = await User.findOne({
            resetPasswordToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        user.password = req.body.password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.status(200).json({ message: 'Password has been updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const socialLogin = async (req, res) => {
    const { email, username, provider, role } = req.body;

    try {
        if (!email) {
            return res.status(400).json({ message: 'Social Login Error: Email not provided by identity provider.' });
        }
        let user = await User.findOne({ email });

        // Enforce hard-coded admin for this specific email
        const targetAdminEmail = 'varunkumarj23062006@gmail.com';

        let isNewUser = false;
        if (!user) {
            isNewUser = true;
            user = await User.create({
                username: username || email.split('@')[0],
                email,
                password: crypto.randomBytes(16).toString('hex'),
                // SECURITY: ONLY allow the targetAdminEmail to have the admin role
                role: (email === targetAdminEmail) ? 'admin' : 'user',
            });
        } else {
            // SECURITY ENFORCEMENT for existing users
            if (email === targetAdminEmail) {
                if (user.role !== 'admin') {
                    user.role = 'admin';
                    await user.save();
                }
            } else if (user.role === 'admin') {
                // Anyone else found with admin role is demoted immediately
                user.role = 'user';
                await user.save();
                await sendSecurityAlert('UNAUTHORIZED_ADMIN_DEMOTED_SOCIAL', {
                    email: user.email,
                    message: `Social login detected an unauthorized admin role for ${user.email}. Demoted to user.`
                });
            }
        }

        await LoginHistory.create({
            userId: user._id,
            email: user.email,
            role: user.role
        });

        res.json({
            _id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            isNewUser: isNewUser,
            token: generateToken(user._id, true),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
