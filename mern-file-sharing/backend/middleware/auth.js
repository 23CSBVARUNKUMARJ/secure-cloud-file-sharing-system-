import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendSecurityAlert } from '../utils/securityMonitor.js';

export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');

            req.user = await User.findById(decoded.id).select('-password');

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

export const admin = async (req, res, next) => {
    const AUTHORIZED_ADMIN = 'varunkumarj23062006@gmail.com';

    if (req.user && req.user.role === 'admin' && req.user.email === AUTHORIZED_ADMIN) {
        next();
    } else {
        const email = req.user ? req.user.email : 'Unknown';
        console.warn(`[SECURITY ALERT] Unauthorized admin access attempt by: ${email}`);

        // DISPATCH ALERT TO OWNER
        await sendSecurityAlert('UNAUTHORIZED_ACCESS_ATTEMPT', {
            email: email,
            message: `User tried to access admin-restricted API/Dashboard: ${req.originalUrl || req.url}`,
            source: 'Admin Middleware Gate'
        });

        res.status(403).json({ message: 'Access Denied: Only the system owner (Varun) can access administrative tools.' });
    }
};
