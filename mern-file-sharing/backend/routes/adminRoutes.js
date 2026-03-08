import express from 'express';
import { getLoginHistory, getAllUsers, deleteUser, updateUserRole, cleanFiles, generateAccessKey } from '../controllers/adminController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.get('/login-history', protect, admin, getLoginHistory);
router.get('/users', protect, admin, getAllUsers);
router.delete('/users/:id', protect, admin, deleteUser);
router.put('/users/:id/role', protect, admin, updateUserRole);
router.post('/clean', protect, admin, cleanFiles);
router.post('/generate-key', protect, admin, generateAccessKey);

export default router;
