import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import File from './models/File.js';
import { sendSecurityAlert } from './utils/securityMonitor.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/file-sharing-app';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev')); // Logging for development
app.use(compression()); // Compress responses for faster delivery

// Serve Uploads Folder
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({ message: 'Something went wrong!', error: err.message });
});

// --- 24/7 GUARDIAN: Global Bug & Error Interceptor ---
process.on('uncaughtException', async (err) => {
    console.error('[24/7 GUARDIAN] Caught Uncaught Exception:', err);
    try {
        if (!fs.existsSync(path.join(__dirname, 'logs'))) fs.mkdirSync(path.join(__dirname, 'logs'));
        fs.appendFileSync(path.join(__dirname, 'logs/guardian.log'), `${new Date().toLocaleString()} - CRITICAL: ${err.stack}\n`);

        // DISPATCH ALERT TO OWNER
        await sendSecurityAlert('SYSTEM_CRITICAL_CRASH', {
            message: `Uncaught Exception: ${err.message}`,
            source: 'Runtime Guardian Engine'
        });
    } catch (e) { }
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('[24/7 GUARDIAN] Unhandled Rejection at:', promise, 'reason:', reason);
    await sendSecurityAlert('PROMISE_UNHANDLED_REJECTION', {
        message: `Unhandled rejection at ${promise}. Reason: ${reason}`,
        source: 'Async Flow Guardian'
    });
});

// --- 24/7 HOUSEKEEPER: Auto Cleanup for Expired Files ---
const runHousekeeper = async () => {
    console.log('[HOUSEKEEPER] Running 24/7 scheduled cleanup...');
    try {
        const now = new Date();
        const expiredFiles = await File.find({ expiresAt: { $ne: null, $lt: now } });

        for (const fileDoc of expiredFiles) {
            console.log(`[HOUSEKEEPER] Purging expired: ${fileDoc.originalName}`);
            const fullPath = path.join(__dirname, fileDoc.filePath);
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            await fileDoc.deleteOne();
        }
        if (expiredFiles.length > 0) console.log(`[HOUSEKEEPER] Auto-removed ${expiredFiles.length} files.`);
    } catch (err) {
        console.error('[HOUSEKEEPER ERROR]', err.message);
    }
};

// Auto-run every 60 minutes
setInterval(runHousekeeper, 3600 * 1000);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER OK] API Gateway running with GLOBAL access on port ${PORT}`);
    console.log(`[MONGODB] Attempting to connect to ${MONGO_URI}...`);

    mongoose.connect(MONGO_URI)
        .then(() => {
            console.log('[MONGODB] Connection Established.');
            runHousekeeper(); // Immediate check on startup
        })
        .catch((error) => {
            console.error('[MONGODB ERROR] Connection Failed! System will retry in background.');
            console.error('Error Details:', error.message);
        });
});

// Trigger Mongoose connection retry
