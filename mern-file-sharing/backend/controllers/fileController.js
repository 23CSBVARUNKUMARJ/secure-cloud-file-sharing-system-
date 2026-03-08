import path from 'path';
import fs from 'fs';
import File from '../models/File.js';

// Setup multer upload directory
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

export const uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { originalname, filename, mimetype, size, path: filePath } = req.file;
        const { expiresAt } = req.body;

        const fileDocument = await File.create({
            originalName: originalname,
            filename,
            mimetype,
            size,
            filePath,
            uploadedBy: req.user._id,
            expiresAt: expiresAt ? new Date(expiresAt) : null
        });

        res.status(201).json(fileDocument);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getFiles = async (req, res) => {
    try {
        const files = await File.find({}).populate('uploadedBy', 'username email role');
        res.json(files);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const downloadFile = async (req, res) => {
    try {
        const file = await File.findById(req.params.id);

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Check for expiration
        if (file.expiresAt && new Date() > new Date(file.expiresAt)) {
            return res.status(410).json({ message: 'Link has expired' });
        }

        const absolutePath = path.resolve(file.filePath);
        res.download(absolutePath, file.originalName);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteFile = async (req, res) => {
    try {
        const file = await File.findById(req.params.id);

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Role check: Only admins can delete files
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to delete this file' });
        }

        // Remove from filesystem
        if (fs.existsSync(file.filePath)) {
            fs.unlinkSync(file.filePath);
        }

        await file.deleteOne();

        res.json({ message: 'File removed successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}
