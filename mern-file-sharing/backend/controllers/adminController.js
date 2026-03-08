import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import LoginHistory from '../models/LoginHistory.js';
import User from '../models/User.js';
import File from '../models/File.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getLoginHistory = async (req, res) => {
    try {
        const history = await LoginHistory.find({}).sort({ createdAt: -1 });
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({}).select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            if (user.role === 'admin' && user._id.toString() === req.user._id.toString()) {
                return res.status(400).json({ message: 'You cannot delete yourself' });
            }
            await user.deleteOne();
            res.json({ message: 'User removed' });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateUserRole = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (user) {
            user.role = req.body.role || user.role;
            const updatedUser = await user.save();
            res.json({
                _id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role,
            });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const cleanFiles = async (req, res) => {
    try {
        const now = new Date();
        const expiredFiles = await File.find({ expiresAt: { $ne: null, $lt: now } });
        let count = 0;

        for (const fileDoc of expiredFiles) {
            const fullPath = path.resolve(fileDoc.filePath);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            await fileDoc.deleteOne();
            count++;
        }

        res.json({ message: `Purge Complete! ${count} expired files removed securely.` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const generateAccessKey = async (req, res) => {
    try {
        const key = 'AKIA' + Math.random().toString(36).substring(2, 12).toUpperCase();
        res.json({ key });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
