import express from 'express';
import multer from 'multer';
import { uploadFile, getFiles, downloadFile, deleteFile } from '../controllers/fileController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination(req, file, cb) {
        cb(null, 'uploads/');
    },
    filename(req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    },
});

const upload = multer({ storage });

router.route('/')
    .post(protect, upload.single('file'), uploadFile)
    .get(protect, getFiles);

router.route('/:id')
    .get(protect, downloadFile)
    .delete(protect, admin, deleteFile);

export default router;
