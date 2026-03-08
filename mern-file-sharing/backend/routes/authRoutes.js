import express from 'express';
import {
    authUser,
    registerUser,
    forgotPassword,
    resetPassword,
    socialLogin,
    checkEmail
} from '../controllers/authController.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', authUser);
router.post('/check-email', checkEmail);
router.post('/social', socialLogin);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);
router.post('/demo', (req, res) => res.status(200).json({ message: 'Demo request received! Our enterprise team will connect with you at ' + req.body.email }));
router.post('/activate-trial', (req, res) => res.status(200).json({ message: '90-Day Enterprise Trial Activated successfully!' }));

export default router;
