# Project Source Code: Secure Cloud File Sharing System

{% raw %}
## File: auto_run.bat
`bat
@echo off
title MERN Cloud - Auto Access Launcher (STABLE)
echo ==============================================
echo     Starting MERN App with Auto Hosting
echo ==============================================
echo.

:: 1. Cleanup
taskkill /F /IM node.exe /T >nul 2>&1

:: 2. Launch App (Backend + Frontend)
echo [1/2] Starting MERN App (Backend Port: 5000, Frontend Port: 5173)...
start "MERN App" cmd /k "npm run dev"

:: 3. Get IP & Start Tunnel
echo [2/2] Getting Access IP...
powershell -Command "(Invoke-WebRequest api.ipify.org).Content" > "%~dp0ip.tmp"
set /p IP_ADDR= < "%~dp0ip.tmp"
del "%~dp0ip.tmp"

echo.
echo ==============================================
echo   ACCESS DETAILS:
echo   Public Link: https://varun-cloud-v2.loca.lt
echo   Password:    %IP_ADDR%
echo ==============================================
echo.
echo Starting Tunnel...
echo Waiting for servers to stabilize...
timeout /t 5 >nul
npx -y localtunnel --port 5173 --subdomain varun-cloud-v2 --local-host 127.0.0.1
pause

`

## File: backend\checkUsers.js
`js
import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/file-sharing-app')
    .then(async () => {
        const users = await User.find({});
        console.log('Registered Users:', users.map(u => ({ email: u.email, role: u.role, username: u.username })));
        mongoose.disconnect();
    })
    .catch(err => console.error(err));

`

## File: backend\controllers\adminController.js
`js
import LoginHistory from '../models/LoginHistory.js';
import User from '../models/User.js';

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

`

## File: backend\controllers\authController.js
`js
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

export const registerUser = async (req, res) => {
    const { username, email, password, role } = req.body;

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
            role: 'user', // Force 'user' role for self-registration. Admin must be manually promoted.
        });

        if (user) {
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

export const authUser = async (req, res) => {
    const { email, password, rememberMe } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user && (await user.matchPassword(password))) {

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
    const { email, username, provider } = req.body;

    try {
        let user = await User.findOne({ email });

        if (!user) {
            user = await User.create({
                username: username || email.split('@')[0],
                email,
                password: crypto.randomBytes(16).toString('hex'),
                role: 'user',
            });
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
            token: generateToken(user._id, true),
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

`

## File: backend\controllers\fileController.js
`js
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

        const fileDocument = await File.create({
            originalName: originalname,
            filename,
            mimetype,
            size,
            filePath,
            uploadedBy: req.user._id,
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

        // All users can download available files now.

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

`

## File: backend\middleware\auth.js
`js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

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

export const admin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as an admin' });
    }
};

`

## File: backend\models\File.js
`js
import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true,
    },
    originalName: {
        type: String,
        required: true,
    },
    mimetype: {
        type: String,
        required: true,
    },
    size: {
        type: Number,
        required: true,
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    filePath: {
        type: String,
        required: true,
    }
}, { timestamps: true });

const File = mongoose.model('File', fileSchema);
export default File;

`

## File: backend\models\LoginHistory.js
`js
import mongoose from 'mongoose';

const loginHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    email: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        required: true,
    },
}, { timestamps: true });

const LoginHistory = mongoose.model('LoginHistory', loginHistorySchema);
export default LoginHistory;

`

## File: backend\models\User.js
`js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;

`

## File: backend\package.json
`json
{
  "name": "backend",
  "version": "1.0.0",
  "description": "Backend for Role-Based File Sharing App",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "compression": "^1.8.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.3.4",
    "morgan": "^1.10.1",
    "multer": "^1.4.5-lts.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}

`

## File: backend\routes\adminRoutes.js
`js
import express from 'express';
import { getLoginHistory, getAllUsers, deleteUser, updateUserRole } from '../controllers/adminController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.get('/login-history', protect, admin, getLoginHistory);
router.get('/users', protect, admin, getAllUsers);
router.delete('/users/:id', protect, admin, deleteUser);
router.put('/users/:id/role', protect, admin, updateUserRole);
export default router;

`

## File: backend\routes\authRoutes.js
`js
import express from 'express';
import {
    authUser,
    registerUser,
    forgotPassword,
    resetPassword,
    socialLogin
} from '../controllers/authController.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', authUser);
router.post('/social', socialLogin);
router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:token', resetPassword);
router.post('/demo', (req, res) => res.status(200).json({ message: 'Demo request received! Our enterprise team will connect with you at ' + req.body.email }));
router.post('/activate-trial', (req, res) => res.status(200).json({ message: '90-Day Enterprise Trial Activated successfully!' }));

export default router;

`

## File: backend\routes\fileRoutes.js
`js
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

`

## File: backend\server.js
`js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/authRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

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

// MongoDB Connection
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/file-sharing-app';

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Error connecting to MongoDB:', error.message);
    });

// Trigger Mongoose connection retry

`

## File: backend\updateAdmin.js
`js
import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const emailToUpdate = process.argv[2];

if (!emailToUpdate) {
    console.log('Please provide an email address: node updateAdmin.js user@example.com');
    process.exit(1);
}

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mern-file-sharing')
    .then(async () => {
        const user = await User.findOneAndUpdate(
            { email: emailToUpdate },
            { role: 'admin' },
            { new: true }
        );

        if (user) {
            console.log(`Success! ${user.email} is now an admin.`);
        } else {
            console.log(`Error: User with email ${emailToUpdate} not found.`);
        }
        mongoose.disconnect();
    })
    .catch(err => {
        console.error('Connection error:', err);
    });

`

## File: build_and_compress.bat
`bat
@echo off
title Cloud Project - Build ^& Compress Tool
echo ==============================================
echo    Building and Compressing Project
echo ==============================================
echo.

:: 1. Build Frontend
echo [1/2] Building Frontend (Minifying Code)...
cd frontend
call npm run build
cd ..

:: 2. Compress Project (Excluding node_modules)
echo [2/2] Creating Project ZIP Archive (This skips node_modules to save space)...

:: Create an exclude file for xcopy
echo \node_modules\> exclude.txt
echo \.git\>> exclude.txt
echo \dist\>> exclude.txt
echo \uploads\>> exclude.txt
echo .zip>> exclude.txt
echo \temp_cloud_build_zip\>> exclude.txt

:: Copy to a temp folder
mkdir temp_cloud_build_zip 2>nul
xcopy . temp_cloud_build_zip /E /I /H /Y /EXCLUDE:exclude.txt >nul

:: Compress the temp folder
powershell -Command "Compress-Archive -Path temp_cloud_build_zip\* -DestinationPath 'Cloud_Project.zip' -Force"

:: Cleanup
rmdir /s /q temp_cloud_build_zip
del exclude.txt
echo.
echo ==============================================
echo   DONE! 
echo   - Minified code created in: frontend/dist
echo   - Full source code compressed to: Cloud_Project.zip
echo ==============================================
echo.
pause

`

## File: frontend\index.html
`html
<!doctype html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Secure Cloud File Sharing System</title>
</head>

<body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
    <script src="https://unpkg.com/boxicons@2.1.4/dist/boxicons.js"></script>
</body>

</html>
`

## File: frontend\package.json
`json
{
    "name": "frontend",
    "private": true,
    "version": "0.0.0",
    "type": "module",
    "scripts": {
        "dev": "vite",
        "build": "vite build",
        "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0",
        "preview": "vite preview"
    },
    "dependencies": {
        "@react-oauth/google": "^0.13.4",
        "axios": "^1.6.8",
        "crypto-js": "^4.2.0",
        "express": "^5.2.1",
        "express-http-proxy": "^2.1.2",
        "http-proxy": "^1.18.1",
        "http-proxy-middleware": "^3.0.5",
        "jwt-decode": "^4.0.0",
        "react": "^18.2.0",
        "react-dom": "^18.2.0",
        "react-router-dom": "^6.23.0"
    },
    "devDependencies": {
        "@vitejs/plugin-react": "^4.2.1",
        "vite": "^5.2.0"
    }
}

`

## File: frontend\serve.js
`js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import httpProxy from 'http-proxy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5173;
const proxy = httpProxy.createProxyServer({});

// Handle proxy errors
proxy.on('error', (err, req, res) => {
    console.error('Proxy Error:', err);
    if (!res.headersSent) {
        res.status(502).send('Proxy Error');
    }
});

// Use middleware to handle proxying manually to avoid the routing error
app.use((req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/uploads')) {
        proxy.web(req, res, { target: 'http://localhost:5000' });
    } else {
        next();
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Final fallback for SPA
app.use((req, res) => {
    const indexPath = path.resolve(__dirname, 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.setHeader('Content-Type', 'text/html');
        res.send(fs.readFileSync(indexPath));
    } else {
        res.status(404).send('Not Found');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bridge Server Running on port ${PORT}`);
});

`

## File: frontend\src\App.jsx
`jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID_HERE";

function App() {
    return (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <Router>
                <div className="app-container">
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/reset-password/:token" element={<ResetPassword />} />
                        <Route path="/" element={<Dashboard />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </div>
            </Router>
        </GoogleOAuthProvider>
    );
}

export default App;

`

## File: frontend\src\components\AwsHeader.css
`css
.aws-header-m {
    width: 100%;
    font-family: inherit;
    display: flex;
    flex-direction: column;
}

/* TOP BAR */
.aws-top-bar {
    background-color: #232f3e;
    height: 40px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding-right: 30px;
}

.aws-top-nav-list {
    display: flex;
    align-items: center;
    gap: 20px;
}

.aws-nav-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    font-weight: 500;
    position: relative;
    padding: 10px 0;
}

.aws-nav-item:hover {
    text-decoration: underline;
}

.aws-dropdown-menu {
    position: absolute;
    top: 40px;
    left: 0;
    background-color: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;
    min-width: 250px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    padding: 10px 0;
    display: flex;
    flex-direction: column;
}

.aws-dropdown-item {
    padding: 12px 20px;
    color: #16191f;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
}

.aws-dropdown-item:hover {
    background-color: #f2f3f3;
    color: #e47911;
    text-decoration: none;
}

.aws-nav-item-login {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 10px;
    cursor: pointer;
    background: transparent;
    padding: 3px;
    border-radius: 50%;
    border: 1.5px solid #fff;
}

/* MIDDLE BAR */
.aws-middle-bar {
    background-color: #fff;
    height: 65px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 40px 0 20px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    z-index: 2;
}

.aws-mid-left {
    display: flex;
    align-items: center;
    gap: 40px;
}

.aws-logo-m {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.aws-logo-text {
    font-size: 26px;
    font-weight: 800;
    color: #232f3e;
    letter-spacing: -1px;
    font-family: 'Helvetica', Arial, sans-serif;
}

.aws-mid-links {
    display: flex;
    gap: 30px;
    align-items: center;
}

.aws-mid-links span {
    font-size: 15px;
    font-weight: 700;
    color: #16191f;
    cursor: pointer;
}

.aws-mid-links span:hover {
    color: #e47911;
}

.aws-mid-right {
    display: flex;
    align-items: center;
    gap: 30px;
}

.aws-search-m {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
}

.search-text-m {
    font-size: 15px;
    font-weight: 700;
    color: #16191f;
}

.aws-auth-links {
    display: flex;
    align-items: center;
    gap: 25px;
}

.aws-sign-in {
    font-size: 15px;
    font-weight: 700;
    color: #16191f;
    cursor: pointer;
}

.aws-sign-in:hover {
    text-decoration: underline;
}

.aws-create-btn {
    background-color: #16191f;
    color: #fff;
    border: none;
    border-radius: 20px;
    padding: 10px 22px;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s;
}

.aws-create-btn:hover {
    background-color: #232f3e;
}

/* BOTTOM BAR */
.aws-bottom-bar {
    background: linear-gradient(90deg, #eedbfa 0%, #b8c9fd 100%);
    padding: 25px 50px;
    display: flex;
    justify-content: center;
    z-index: 1;
}

.aws-bot-inner {
    background: #fff;
    width: 100%;
    max-width: 1500px;
    border-radius: 8px;
    padding: 0 30px;
    display: flex;
    align-items: center;
    height: 65px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
}

.aws-management-title {
    font-size: 17px;
    font-weight: 700;
    color: #16191f;
    margin-right: 60px;
}

.aws-bot-links {
    display: flex;
    gap: 35px;
    height: 100%;
}

.aws-bot-links span {
    display: flex;
    align-items: center;
    font-size: 14px;
    font-weight: 500;
    color: #16191f;
    cursor: pointer;
    position: relative;
    padding: 0 5px;
}

.aws-bot-links span:hover {
    color: #e47911;
}

.active-bot-link {
    font-weight: 700 !important;
}

.active-bot-link::after {
    content: '';
    position: absolute;
    bottom: 0px;
    left: 0;
    width: 100%;
    height: 3px;
    background-color: #16191f;
}
`

## File: frontend\src\components\AwsHeader.jsx
`jsx
import { useState } from 'react';
import './AwsHeader.css';

export default function AwsHeader() {
    const [isSupportOpen, setIsSupportOpen] = useState(false);

    return (
        <header className="aws-header-m">
            {/* Top Bar - Dark Navy */}
            <div className="aws-top-bar">
                <div className="aws-top-nav-list">
                    <div className="aws-nav-item">
                        <box-icon name='globe' color='#ccc' size='14px'></box-icon>
                        <span>English</span>
                        <box-icon name='chevron-down' color='#ccc' size='14px'></box-icon>
                    </div>
                    <div className="aws-nav-item">Contact us</div>
                    <div className="aws-nav-item">AWS Marketplace</div>
                    <div
                        className="aws-nav-item dropdown-trigger"
                        onMouseEnter={() => setIsSupportOpen(true)}
                        onMouseLeave={() => setIsSupportOpen(false)}
                    >
                        <span>Support</span>
                        <box-icon name='chevron-down' color='#ccc' size='14px'></box-icon>

                        {isSupportOpen && (
                            <div className="aws-dropdown-menu">
                                <div className="aws-dropdown-item">Support Center</div>
                                <div className="aws-dropdown-item">Expert Help</div>
                                <div className="aws-dropdown-item">Documentation</div>
                                <div className="aws-dropdown-item">Knowledge Center</div>
                                <div className="aws-dropdown-item">AWS Support Overview</div>
                                <div className="aws-dropdown-item">AWS re:Post</div>
                            </div>
                        )}
                    </div>
                    <div className="aws-nav-item">
                        <span>My account</span>
                        <box-icon name='chevron-down' color='#ccc' size='14px'></box-icon>
                    </div>
                    <div className="aws-nav-item-login">
                        <box-icon name='user' type='regular' color='#fff' size='18px'></box-icon>
                    </div>
                </div>
            </div>

            {/* Middle Bar - White */}
            <div className="aws-middle-bar">
                <div className="aws-mid-left">
                    <div className="aws-logo-m">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg" alt="AWS Logo" style={{ height: '28px' }} />
                    </div>
                    <div className="aws-mid-links">
                        <span>Discover AWS</span>
                        <span>Products</span>
                        <span>Solutions</span>
                        <span>Pricing</span>
                        <span className="active-link">Resources</span>
                    </div>
                </div>
                <div className="aws-mid-right">
                    <div className="aws-search-m">
                        <box-icon name='search' color='#16191f' size='16px'></box-icon>
                        <span className="search-text-m">Search</span>
                    </div>
                    <div className="aws-auth-links">
                        <span className="aws-sign-in">Sign in to console</span>
                        <button className="aws-create-btn">Create account</button>
                    </div>
                </div>
            </div>

            {/* Bottom Bar - Gradient/White */}
            <div className="aws-bottom-bar">
                <div className="aws-bot-inner">
                    <div className="aws-management-title">
                        AWS Management Console
                    </div>
                    <div className="aws-bot-links">
                        <span className="active-bot-link">Overview</span>
                        <span>Features</span>
                        <span>Mobile Application</span>
                        <span>FAQs</span>
                    </div>
                </div>
            </div>
        </header>
    );
}

`

## File: frontend\src\components\DashboardHero.css
`css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap');

.dashboard-hero {
    position: relative;
    background-color: #001a33;
    padding: 60px 50px;
    border-radius: 20px;
    margin: 25px 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    color: #ffffff;
    min-height: 400px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
    font-family: 'Outfit', sans-serif;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.hero-content {
    position: relative;
    z-index: 5;
    max-width: 700px;
    animation: fadeInUp 0.8s ease-out;
}

@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.hero-title {
    font-size: 3.8rem;
    font-weight: 900;
    line-height: 1;
    margin-bottom: 24px;
    letter-spacing: -2px;
}

.hero-title .highlight {
    background: linear-gradient(90deg, #ffffff 0%, #94a3b8 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    display: block;
}

.hero-description {
    font-size: 1.3rem;
    color: #cbd5e1;
    margin-bottom: 40px;
    line-height: 1.5;
    font-weight: 400;
    max-width: 600px;
}

.hero-actions {
    display: flex;
    gap: 20px;
}

.btn-primary-hero {
    background-color: #ffb800;
    color: #000000;
    border: none;
    padding: 16px 32px;
    border-radius: 10px;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.btn-primary-hero:hover {
    background-color: #ffcc33;
    transform: scale(1.05) translateY(-3px);
    box-shadow: 0 15px 30px rgba(255, 184, 0, 0.4);
}

.btn-secondary-hero {
    background-color: #ffffff;
    color: #000000;
    border: none;
    padding: 16px 32px;
    border-radius: 10px;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    display: flex;
    align-items: center;
    gap: 12px;
}

.btn-secondary-hero:hover {
    background-color: #f8fafc;
    transform: scale(1.05) translateY(-3px);
    box-shadow: 0 15px 30px rgba(255, 255, 255, 0.2);
}

.btn-secondary-hero .arrow {
    transition: transform 0.3s ease;
    font-size: 1.2rem;
}

.btn-secondary-hero:hover .arrow {
    transform: translateX(8px);
}

.hero-background-text {
    position: absolute;
    right: -120px;
    top: 55%;
    transform: translateY(-50%);
    font-size: 18rem;
    font-weight: 950;
    color: rgba(255, 255, 255, 0.04);
    white-space: nowrap;
    pointer-events: none;
    z-index: 1;
    letter-spacing: -10px;
    text-transform: uppercase;
}

.hero-glow-1 {
    position: absolute;
    top: -100px;
    right: -50px;
    width: 700px;
    height: 700px;
    background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0) 70%);
    z-index: 0;
}

.hero-glow-2 {
    position: absolute;
    bottom: -150px;
    left: -50px;
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, rgba(56, 189, 248, 0) 70%);
    z-index: 0;
}

.hero-toast {
    margin-top: 30px;
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.4);
    padding: 14px 24px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
    width: fit-content;
    animation: fadeInUp 0.4s ease-out;
    backdrop-filter: blur(5px);
}

.hero-toast span {
    color: #4ade80;
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: 0.5px;
}

/* BLUE GLOW EFFECT FOR ALL ICONS */
box-icon {
    filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.7));
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

box-icon:hover {
    filter: drop-shadow(0 0 15px rgba(56, 189, 248, 1));
    transform: scale(1.2) rotate(5deg);
}

@media (max-width: 1200px) {
    .hero-title {
        font-size: 3.2rem;
    }

    .hero-background-text {
        font-size: 14rem;
        right: -80px;
    }
}

@media (max-width: 1024px) {
    .hero-title {
        font-size: 2.8rem;
    }
}

@media (max-width: 768px) {
    .dashboard-hero {
        padding: 50px 30px;
        min-height: auto;
        text-align: center;
        justify-content: center;
    }

    .hero-content {
        max-width: 100%;
    }

    .hero-title {
        font-size: 2.4rem;
        letter-spacing: -1px;
    }

    .hero-description {
        font-size: 1.1rem;
        margin-bottom: 30px;
    }

    .hero-background-text {
        display: none;
    }

    .hero-actions {
        flex-direction: column;
        align-items: center;
    }

    .btn-primary-hero,
    .btn-secondary-hero {
        width: 100%;
        max-width: 320px;
        justify-content: center;
    }
}
`

## File: frontend\src\components\DashboardHero.jsx
`jsx
import React, { useState } from 'react';
import axios from 'axios';
import './DashboardHero.css';

const DashboardHero = () => {
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleDemoRequest = async () => {
        setLoading(true);
        try {
            const userInfo = JSON.parse(localStorage.getItem('userInfo'));
            const { data } = await axios.post('/api/auth/demo', { email: userInfo.email });
            setMessage(data.message);
        } catch (err) {
            setMessage('Something went wrong. Please try again later.');
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 6000);
        }
    };

    const handleFreeTrial = async () => {
        setLoading(true);
        try {
            const { data } = await axios.post('/api/auth/activate-trial');
            setMessage(data.message);
        } catch (err) {
            setMessage('Trial activation failed. Check connection.');
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 6000);
        }
    };

    return (
        <section className="dashboard-hero">
            <div className="hero-content">
                <h1 className="hero-title">
                    Ready to Transform Your <span className="highlight">Cloud Strategy?</span>
                </h1>
                <p className="hero-description">
                    Gain full visibility, enforce compliance, and secure every workflow with trusted file sharing and policy-driven automation.
                </p>
                <div className="hero-actions">
                    <button className="btn-primary-hero" onClick={handleDemoRequest} disabled={loading}>
                        {loading ? 'Sending...' : 'Request a Demo'}
                    </button>
                    <button className="btn-secondary-hero" onClick={handleFreeTrial} disabled={loading}>
                        {loading ? 'Processing...' : 'Free Trial'} <span className="arrow">→</span>
                    </button>
                </div>
                {message && (
                    <div className="hero-toast fade-in">
                        <box-icon name='check-circle' color='#22c55e' size='18px'></box-icon>
                        <span>{message}</span>
                    </div>
                )}
            </div>
            <div className="hero-background-text">
                GET STARTED
            </div>
            <div className="hero-glow-1"></div>
            <div className="hero-glow-2"></div>
        </section>
    );
};

export default DashboardHero;

`

## File: frontend\src\components\Footer.css
`css
.aws-style-footer {
    background-color: #16191f;
    width: 100%;
    color: #fff;
    font-family: inherit;
    padding-top: 60px;
    margin-top: 50px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.aws-footer-content {
    display: flex;
    justify-content: space-between;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 40px;
}

.aws-footer-column {
    display: flex;
    flex-direction: column;
    gap: 15px;
    flex: 1;
}

.aws-footer-column h4 {
    font-size: 16px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 8px;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 12px;
}

.aws-footer-column h4 box-icon {
    filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.4));
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.aws-footer-column:hover h4 box-icon {
    transform: rotate(15deg) scale(1.2);
    filter: drop-shadow(0 0 12px rgba(56, 189, 248, 0.7));
}

.aws-footer-column a {
    color: #b1b5bd;
    font-size: 14px;
    text-decoration: none;
    font-weight: 400;
    transition: all 0.3s ease;
    position: relative;
    display: inline-block;
    width: fit-content;
}

.aws-footer-column a::after {
    content: '';
    position: absolute;
    width: 0;
    height: 1.5px;
    bottom: -2px;
    left: 0;
    background-color: #38bdf8;
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.aws-footer-column a:hover {
    color: #fff;
    transform: translateX(10px);
}

.aws-footer-column a:hover::after {
    width: 100%;
    box-shadow: 0 0 8px rgba(56, 189, 248, 0.6);
}

.aws-footer-back-to-top {
    text-align: center;
    padding: 25px 0;
    margin-top: 80px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 800;
    color: #fff;
    background-color: #1a222c;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 2px;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.aws-footer-back-to-top:hover {
    background-color: #243447;
    color: #38bdf8;
    box-shadow: 0 -5px 15px rgba(0, 0, 0, 0.3);
}

.aws-footer-bottom {
    background-color: #0c0f14;
    padding: 35px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.bottom-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.bottom-content p {
    font-size: 13.5px;
    color: #94A3B8;
    margin: 0;
}

.dev-name {
    color: #38BDF8;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-shadow: 0 0 5px rgba(56, 189, 248, 0.2);
}

.social-links {
    display: flex;
    gap: 20px;
}

.social-links box-icon {
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    filter: drop-shadow(0 0 5px rgba(56, 189, 248, 0.2));
}

.social-links box-icon:hover {
    transform: translateY(-8px) scale(1.15);
    filter: drop-shadow(0 0 12px rgba(56, 189, 248, 0.8));
    color: #38BDF8 !important;
}

@media (max-width: 768px) {
    .aws-footer-content {
        flex-direction: column;
        gap: 40px;
    }

    .bottom-content {
        flex-direction: column;
        gap: 25px;
        text-align: center;
    }
}
`

## File: frontend\src\components\Footer.jsx
`jsx
import './Footer.css';

export default function Footer() {
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    return (
        <footer className="aws-style-footer">
            <div className="aws-footer-content">
                <div className="aws-footer-column">
                    <h4><box-icon name='graduation-cap' type='solid' color='#38bdf8' size='20px'></box-icon> Learn</h4>
                    <a href="#">What Is Secure Cloud?</a>
                    <a href="#">What Is Cloud Storage?</a>
                    <a href="#">What Is IAM Access?</a>
                    <a href="#">Secure File Sharing Hub</a>
                    <a href="#">Cloud Data Security</a>
                    <a href="#">What's New</a>
                    <a href="#">Blogs</a>
                    <a href="#">Press Releases</a>
                </div>

                <div className="aws-footer-column">
                    <h4><box-icon name='book-open' type='solid' color='#38bdf8' size='20px'></box-icon> Resources</h4>
                    <a href="#">Getting Started</a>
                    <a href="#">Training</a>
                    <a href="#">Cloud Trust Center</a>
                    <a href="#">Storage Solutions Library</a>
                    <a href="#">Architecture Center</a>
                    <a href="#">Product and Technical FAQs</a>
                    <a href="#">Analyst Reports</a>
                    <a href="#">Integration Partners</a>
                </div>

                <div className="aws-footer-column">
                    <h4><box-icon name='code-block' type='solid' color='#38bdf8' size='20px'></box-icon> Developers</h4>
                    <a href="#">Builder Center</a>
                    <a href="#">SDKs & Tools</a>
                    <a href="#">Cloud API Reference</a>
                    <a href="#">React UI Components</a>
                    <a href="#">Node.js on Secure Cloud</a>
                    <a href="#">Python on Secure Cloud</a>
                    <a href="#">Enterprise GitHub</a>
                </div>

                <div className="aws-footer-column">
                    <h4><box-icon name='help-circle' type='solid' color='#38bdf8' size='20px'></box-icon> Help</h4>
                    <a href="#">Contact Us</a>
                    <a href="#">File a Support Ticket</a>
                    <a href="#">Cloud re:Post</a>
                    <a href="#">Knowledge Center</a>
                    <a href="#">Platform Support Overview</a>
                    <a href="#">Get Expert Help</a>
                    <a href="#">Dashboard Accessibility</a>
                    <a href="#">Legal</a>
                </div>
            </div>

            <div className="aws-footer-back-to-top" onClick={scrollToTop}>
                Back to top <span style={{ marginLeft: '5px' }}>↑</span>
            </div>

            <div className="aws-footer-bottom">
                <div className="bottom-content">
                    <p>© 2026 SecureCloud System | Built by <span className="dev-name">VARUN KUMAR J</span></p>
                    <div className="social-links">
                        <box-icon type='logo' name='linkedin-square' color='#94a3b8' size='22px'></box-icon>
                        <box-icon type='logo' name='github' color='#94a3b8' size='22px'></box-icon>
                        <box-icon name='envelope' type='solid' color='#94a3b8' size='22px'></box-icon>
                    </div>
                </div>
            </div>
        </footer>
    );
}

`

## File: frontend\src\components\Logo.jsx
`jsx
export default function Logo() {
    return (
        <div className="cloud-logo">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ overflow: 'visible', width: '100%', height: '100%' }}>
                <defs>
                    <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#2563EB" />   {/* Deep Blue */}
                        <stop offset="50%" stopColor="#9333EA" />  {/* Purple */}
                        <stop offset="100%" stopColor="#DB2777" /> {/* Magenta/Pink */}
                    </linearGradient>
                    <linearGradient id="serverGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#60A5FA" />   {/* Light Blue */}
                        <stop offset="100%" stopColor="#D946EF" /> {/* Light Magenta */}
                    </linearGradient>
                    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>

                <g transform="translate(0, -5)" filter="url(#neonGlow)">
                    {/* Cloud Arch */}
                    <path d="M 38 78 L 28 78 A 15 15 0 0 1 30 45 A 24 24 0 0 1 70 45 A 15 15 0 0 1 72 78 L 62 78"
                        fill="none" stroke="url(#cloudGrad)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Top Server Blade */}
                    <rect x="35" y="48" width="30" height="7.5" rx="1.5" fill="url(#serverGrad)" />
                    <line x1="38" y1="51.75" x2="55" y2="51.75" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="61" cy="51.75" r="1.5" fill="#FFFFFF" />

                    {/* Middle Server Blade */}
                    <rect x="35" y="60" width="30" height="7.5" rx="1.5" fill="url(#serverGrad)" />
                    <line x1="38" y1="63.75" x2="55" y2="63.75" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="61" cy="63.75" r="1.5" fill="#FFFFFF" />

                    {/* Bottom Server Blade */}
                    <rect x="35" y="72" width="30" height="7.5" rx="1.5" fill="url(#serverGrad)" />
                    <line x1="38" y1="75.75" x2="55" y2="75.75" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="61" cy="75.75" r="1.5" fill="#FFFFFF" />
                </g>
            </svg>
        </div>
    );
}

`

## File: frontend\src\index.css
`css
:root {
    --primary-color: #3b82f6;
    /* Blue 500 */
    --primary-hover: #2563eb;
    /* Blue 600 */
    --bg-dark-blue: #0f172a;
    /* Slate 900 */
    --bg-deep-blue: #1e3a8a;
    /* Blue 900 */
    --card-bg: rgba(30, 41, 59, 0.75);
    /* Slate 800 semi-transparent */
    --text-primary: #f8fafc;
    /* Slate 50 */
    --text-secondary: #94a3b8;
    /* Slate 400 */
    --border-color: rgba(148, 163, 184, 0.2);
    --error: #ef4444;
    --success: #10b981;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: linear-gradient(-45deg, #0f172a, #1e3a8a, #2563eb, #0f172a);
    background-size: 400% 400%;
    animation: gradientBG 15s ease infinite;
    min-height: 100vh;
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
}

@keyframes gradientBG {
    0% {
        background-position: 0% 50%;
    }

    50% {
        background-position: 100% 50%;
    }

    100% {
        background-position: 0% 50%;
    }
}

/* Glassmorphism Auth Cards */
.auth-container {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
}

.auth-card {
    background: var(--card-bg);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    padding: 3rem;
    width: 100%;
    max-width: 450px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.auth-header {
    text-align: center;
    margin-bottom: 2rem;
}

.auth-header h2 {
    font-size: 1.875rem;
    font-weight: 700;
    margin-top: 1rem;
    color: var(--text-primary);
}

.form-group {
    margin-bottom: 1.25rem;
}

.form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 0.5rem;
}

.form-group input[type="text"],
.form-group input[type="email"],
.form-group input[type="password"] {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    font-size: 1rem;
    transition: all 0.3s;
    background: rgba(15, 23, 42, 0.6);
    color: var(--text-primary);
}

.form-group input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
}

.form-options {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
}

.btn-primary {
    width: 100%;
    background-color: var(--primary-color);
    color: white;
    padding: 0.875rem;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.3s, transform 0.1s;
}

.btn-primary:hover {
    background-color: var(--primary-hover);
}

.btn-primary:active {
    transform: scale(0.98);
}

.form-footer {
    text-align: center;
    margin-top: 1.5rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
}

.form-footer a {
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 600;
}

.form-footer a:hover {
    text-decoration: underline;
}

/* Dashboard Styles */
.dashboard-container {
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
}

.dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
    background: var(--card-bg);
    padding: 1.5rem 2rem;
    border-radius: 1rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
}

.user-info {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.role-badge {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
}

.role-badge.admin {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
}

.file-list {
    background: var(--card-bg);
    border-radius: 1rem;
    overflow: hidden;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
}

.file-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    border-bottom: 1px solid var(--border-color);
}

.file-item:last-child {
    border-bottom: none;
}

.file-info h4 {
    font-size: 1rem;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
}

.file-info p {
    font-size: 0.875rem;
    color: var(--text-secondary);
}

/* Unique Animated Cloud Logo */
.cloud-logo {
    display: flex;
    justify-content: center;
    perspective: 1000px;
}

.cloud-logo svg {
    width: 95px;
    height: 95px;
    filter: drop-shadow(0 15px 15px rgba(37, 99, 235, 0.4));
    animation: fly 4s ease-in-out infinite alternate;
    transform-style: preserve-3d;
}

/* Ensure Dashboard Header Logo is Large */
.dashboard-logo-container .cloud-logo svg {
    min-width: 95px !important;
    min-height: 95px !important;
}

@keyframes fly {
    0% {
        transform: translateY(0px) rotateY(-8deg) rotateX(4deg) scale(0.95);
        filter: drop-shadow(0 10px 10px rgba(37, 99, 235, 0.3));
    }

    50% {
        transform: translateY(-12px) rotateY(8deg) rotateX(-4deg) scale(1.02);
        filter: drop-shadow(0 25px 20px rgba(96, 165, 250, 0.6));
    }

    100% {
        transform: translateY(0px) rotateY(-8deg) rotateX(4deg) scale(0.95);
        filter: drop-shadow(0 10px 10px rgba(37, 99, 235, 0.3));
    }
}

/* Developer Footer Branding */
.dev-signature {
    text-align: center;
    padding: 2.5rem 1rem 1.5rem;
    margin-top: auto;
    width: 100%;
    color: var(--text-secondary);
    font-size: 0.95rem;
    letter-spacing: 0.5px;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    transition: all 0.4s ease;
    cursor: default;
}

.dev-logo-container {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(217, 70, 239, 0.3);
    border-radius: 50%;
    width: 45px;
    height: 45px;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 0 15px rgba(217, 70, 239, 0.15);
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.dev-signature:hover .dev-logo-container {
    box-shadow: 0 0 25px rgba(217, 70, 239, 0.6);
    border-color: rgba(217, 70, 239, 0.8);
    transform: rotate(360deg) scale(1.1);
}

.dev-signature:hover {
    transform: translateY(-5px);
}

.dev-signature p {
    font-weight: 500;
}

.dev-signature .highlighted-name {
    color: var(--primary-color);
    font-weight: 800;
    text-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
    background: linear-gradient(90deg, #60A5FA, #D946EF, #60A5FA);
    background-size: 200% auto;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    display: inline-block;
    letter-spacing: 1px;
    animation: dev-shine 3s linear infinite;
}

@keyframes dev-shine {
    to {
        background-position: 200% center;
    }
}

/* ========================================================= */
/* DASHBOARD REDESIGN - GLASSMORPHISM & GRID                 */
/* ========================================================= */

.glass-panel {
    background: rgba(15, 23, 42, 0.4);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
    border-radius: 12px;
}

.interactive-zone {
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease, border-color 0.3s ease;
}

.interactive-zone:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.5);
    border-color: rgba(96, 165, 250, 0.3);
}

.user-badge {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.btn-logout {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.5);
    color: #FCA5A5;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-logout:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #fff;
    border-color: #EF4444;
}

.btn-share {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: transparent;
    border: 1px solid rgba(16, 185, 129, 0.5);
    color: #6EE7B7;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-share:hover {
    background: rgba(16, 185, 129, 0.1);
    color: #fff;
    border-color: #10B981;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
}

.upload-header {
    text-align: center;
    margin-bottom: 2rem;
}

.upload-header box-icon {
    margin-bottom: 0.5rem;
}

.upload-header p {
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-top: 0.25rem;
}

.custom-file-input {
    display: flex;
    justify-content: center;
    margin-bottom: 1.5rem;
}

.custom-file-input input[type="file"] {
    display: none;
}

.file-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: rgba(0, 0, 0, 0.3);
    border: 2px dashed rgba(96, 165, 250, 0.4);
    border-radius: 12px;
    color: var(--text-primary);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    width: 100%;
    max-width: 400px;
    justify-content: center;
}

.file-label:hover {
    border-color: var(--primary-color);
    background: rgba(59, 130, 246, 0.05);
}

.btn-upload {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    max-width: 400px;
    margin: 0 auto;
    background: linear-gradient(135deg, var(--primary-color), #9333EA);
    color: white;
    padding: 1rem;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
}

.btn-upload:hover {
    box-shadow: 0 6px 20px rgba(147, 51, 234, 0.4);
    transform: translateY(-2px);
}

.btn-upload:disabled {
    background: #374151;
    color: #9CA3AF;
    box-shadow: none;
    cursor: not-allowed;
    transform: none;
}

/* File Grid System */
.file-list-container {
    padding: 1rem 0;
}

.section-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.file-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
}

.file-card {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
}

.file-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 4px;
    height: 100%;
    background: linear-gradient(to bottom, var(--primary-color), #D946EF);
    border-radius: 4px 0 0 4px;
}

.file-icon-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 60px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
    margin-bottom: 1rem;
}

.file-info {
    flex-grow: 1;
    margin-bottom: 1.5rem;
}

.file-info h4 {
    font-size: 1.1rem;
    color: var(--text-primary);
    margin-bottom: 0.75rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.file-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 0.4rem;
}

.admin-meta {
    color: #FBBF24;
    font-weight: 500;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px dashed rgba(255, 255, 255, 0.1);
}

.file-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: auto;
}

.action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.6rem;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s;
}

.download-btn {
    flex-grow: 1;
    background: rgba(59, 130, 246, 0.15);
    color: #93C5FD;
    border: 1px solid rgba(59, 130, 246, 0.3);
}

.download-btn:hover {
    background: rgba(59, 130, 246, 0.3);
    color: #fff;
}

.delete-btn {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    width: 42px;
}

.delete-btn:hover {
    background: rgba(239, 68, 68, 0.3);
}

.empty-state {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--text-secondary);
    background: rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    border: 1px dashed rgba(255, 255, 255, 0.1);
}

.empty-state p {
    margin-top: 1rem;
    font-size: 1.1rem;
}

.upload-section {
    background: var(--card-bg);
    padding: 2rem;
    border-radius: 1rem;
    margin-bottom: 2rem;
    text-align: center;
    border: 2px dashed rgba(59, 130, 246, 0.5);
    background-color: rgba(59, 130, 246, 0.05);
    backdrop-filter: blur(10px);
}

/* Cross-Platform Responsiveness (iPhone, Android, Tablets) */
@media screen and (max-width: 768px) {
    .dashboard-header {
        flex-direction: column;
        text-align: center;
        gap: 1.5rem;
    }

    .user-info {
        flex-direction: column;
        width: 100%;
    }

    .file-item {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
    }

    .file-item>div:last-child {
        width: 100%;
        display: flex;
        justify-content: stretch;
    }

    .file-item button {
        flex: 1;
    }

    .auth-card {
        padding: 2rem 1.5rem;
    }
}
`

## File: frontend\src\main.jsx
`jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)

`

## File: frontend\src\pages\Auth.css
`css
@import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');

.auth-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    background: linear-gradient(-45deg, #0f172a, #1e293b, #030712, #1e293b);
    background-size: 400% 400%;
    animation: gradientBG 15s ease infinite;
}

@keyframes gradientBG {
    0% {
        background-position: 0% 50%;
    }

    50% {
        background-position: 100% 50%;
    }

    100% {
        background-position: 0% 50%;
    }
}

.auth-wrapper * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: 'Poppins', sans-serif;
    color: #fff;
}

.auth-wrapper .container {
    position: relative;
    width: 850px;
    height: 620px;
    background: rgba(15, 23, 42, 0.7);
    backdrop-filter: blur(15px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(59, 130, 246, 0.3);
    border-radius: 24px;
    overflow: hidden;
    animation: float 6s ease-in-out infinite;
}

@keyframes float {
    0% {
        transform: translateY(0px);
    }

    50% {
        transform: translateY(-10px);
    }

    100% {
        transform: translateY(0px);
    }
}

.auth-wrapper .form-box {
    position: absolute;
    top: 0;
    width: 50%;
    height: 100%;
    display: flex;
    justify-content: flex-start;
    flex-direction: column;
    z-index: 10;
}

.auth-wrapper .form-box.Login {
    left: 0;
    padding: 60px 40px 0;
}

.auth-wrapper .form-box.Login .animation {
    transform: translateX(0%);
    transition: .7s;
    opacity: 1;
    transition-delay: calc(.1s * var(--S));
}

.auth-wrapper .container.active .form-box.Login .animation {
    transform: translateX(-120%);
    opacity: 0;
    transition-delay: calc(.1s * var(--D));
}

.auth-wrapper .form-box.Register {
    right: 0;
    padding: 40px 60px 0;
}

.auth-wrapper .form-box.Register .animation {
    transform: translateX(120%);
    transition: .7s ease;
    opacity: 0;
    filter: blur(10px);
    transition-delay: calc(.1s * var(--S));
}

.auth-wrapper .container.active .form-box.Register .animation {
    transform: translateX(0%);
    opacity: 1;
    filter: blur(0px);
    transition-delay: calc(.1s * var(--li));
}

.auth-wrapper .form-box h2 {
    font-size: 32px;
    text-align: center;
    color: #fff;
    font-weight: 700;
}

.form-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin-bottom: 5px;
}

.header-icon {
    filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.6));
    animation: iconPulse 3s infinite ease-in-out;
    margin-bottom: 5px;
}

@keyframes iconPulse {
    0% {
        transform: scale(1);
        filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.4));
    }

    50% {
        transform: scale(1.1);
        filter: drop-shadow(0 0 15px rgba(59, 130, 246, 0.9));
    }

    100% {
        transform: scale(1);
        filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.4));
    }
}

.auth-wrapper .form-box .input-box {
    position: relative;
    width: 100%;
    height: 46px;
    margin-top: 16px;
}

.auth-wrapper .input-box input {
    width: 100%;
    height: 100%;
    background: transparent;
    border: none;
    outline: none;
    font-size: 16px;
    color: #fff;
    font-weight: 600;
    border-bottom: 2px solid #fff;
    padding: 0 45px 0 15px;
    transition: all .3s ease;
}

.auth-wrapper .input-box input:focus,
.auth-wrapper .input-box input:valid {
    border-bottom: 2px solid #3B82F6;
}

.auth-wrapper .input-box label {
    position: absolute;
    top: 50%;
    left: 15px;
    transform: translateY(-50%);
    font-size: 16px;
    color: #94A3B8;
    transition: .5s;
    pointer-events: none;
}

.auth-wrapper .input-box input:focus~label,
.auth-wrapper .input-box input:valid~label {
    top: -5px;
    left: 0;
    color: #3B82F6;
    text-shadow: 0 0 5px rgba(59, 130, 246, 0.5);
}

.error-toast {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(239, 68, 68, 0.9);
    border: 1px solid #FCA5A5;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 500;
    text-align: center;
    z-index: 9999;
    box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4);
    animation: toastFadeIn 0.3s ease forwards;
    max-width: 90%;
    width: max-content;
    word-break: break-word;
}

.info-toast {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(59, 130, 246, 0.9);
    border: 1px solid #93C5FD;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 500;
    text-align: center;
    z-index: 9999;
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
    animation: toastFadeIn 0.3s ease forwards;
    max-width: 90%;
    width: max-content;
    word-break: break-word;
}

@keyframes toastFadeIn {
    from {
        opacity: 0;
        transform: translate(-50%, -10px);
    }

    to {
        opacity: 1;
        transform: translate(-50%, 0);
    }
}

.auth-wrapper .input-box box-icon {
    position: absolute;
    top: 50%;
    right: 0;
    font-size: 18px;
    transform: translateY(-50%);
    color: #fff;
}

.auth-wrapper .input-box input:focus~box-icon,
.auth-wrapper .input-box input:valid~box-icon {
    color: #3B82F6;
}

.auth-wrapper .btn {
    position: relative;
    width: 100%;
    height: 45px;
    background: transparent;
    border-radius: 40px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 600;
    border: 2px solid #3B82F6;
    overflow: hidden;
    z-index: 1;
    color: #fff;
    transition: all 0.3s ease;
}

.auth-wrapper .btn::before {
    content: "";
    position: absolute;
    height: 300%;
    width: 100%;
    background: linear-gradient(#0F172A, #3B82F6, #0F172A, #3B82F6);
    top: -100%;
    left: 0;
    z-index: -1;
    transition: .5s cubic-bezier(0.4, 0, 0.2, 1);
}

.auth-wrapper .btn:hover {
    box-shadow: 0 6px 25px rgba(59, 130, 246, 0.6);
    transform: translateY(-2px);
}

.auth-wrapper .btn:hover:before {
    top: 0;
    opacity: 1;
}

.auth-wrapper .regi-link {
    font-size: 14.5px;
    text-align: center;
    margin: 25px 0 10px;
    width: 100%;
    display: flex;
    justify-content: center;
}

.auth-wrapper .regi-link p {
    color: #94A3B8;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 10px;
}

.auth-wrapper .regi-link a {
    text-decoration: none;
    color: #3B82F6;
    font-weight: 600;
}

.auth-wrapper .regi-link a:hover {
    text-decoration: underline;
}

.auth-wrapper .form-options a {
    transition: all 0.3s ease;
}

.auth-wrapper .form-options a:hover {
    color: #3B82F6 !important;
    text-shadow: 0 0 10px rgba(59, 130, 246, 0.8);
    transform: scale(1.05);
}

.auth-wrapper .form-options input[type="checkbox"] {
    accent-color: #3B82F6;
    cursor: pointer;
    box-shadow: 0 0 5px rgba(59, 130, 246, 0.3);
}

.auth-wrapper .form-options label:hover {
    color: #fff !important;
    text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
}

.auth-wrapper .info-content {
    position: absolute;
    top: 0;
    height: 100%;
    width: 50%;
    display: flex;
    justify-content: flex-start;
    flex-direction: column;
    z-index: 10;
}

.auth-wrapper .info-content.Login {
    right: 0;
    text-align: center;
    padding: 30px 30px 0 160px;
}

.auth-wrapper .info-content.Login .animation {
    transform: translateX(0);
    transition: .7s ease;
    transition-delay: calc(.1s * var(--S));
    opacity: 1;
    filter: blur(0px);
}

.auth-wrapper .container.active .info-content.Login .animation {
    transform: translateX(120%);
    opacity: 0;
    filter: blur(10px);
    transition-delay: calc(.1s * var(--D));
}

.auth-wrapper .info-content.Register {
    left: 0;
    text-align: center;
    padding: 30px 160px 0 30px;
    pointer-events: none;
}

.auth-wrapper .info-content.Register .animation {
    transform: translateX(-120%);
    transition: .7s ease;
    opacity: 0;
    filter: blur(10px);
    transition-delay: calc(.1s * var(--S));
}

.auth-wrapper .container.active .info-content.Register .animation {
    transform: translateX(0%);
    opacity: 1;
    filter: blur(0);
    transition-delay: calc(.1s * var(--li));
}

.auth-wrapper .info-content h2 {
    text-transform: uppercase;
    font-size: 28px;
    line-height: 1.25;
    letter-spacing: 2.5px;
    font-weight: 800;
    color: #ffffff;
    text-shadow: 0 10px 30px rgba(96, 165, 250, 0.4);
    margin-bottom: 12px;
}

.auth-wrapper .info-content p {
    font-size: 14.5px;
    line-height: 1.6;
    letter-spacing: 0.5px;
    color: #E2E8F0;
    font-weight: 400;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    opacity: 0.9;
}

/* Custom Segmented Radio Buttons for Role */
.role-options {
    display: flex;
    gap: 0.5rem;
    background: rgba(0, 0, 0, 0.3);
    padding: 0.25rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    margin-bottom: 12px;
}

.role-options label {
    flex: 1;
    text-align: center;
    padding: 0.6rem;
    cursor: pointer;
    color: #94A3B8;
    border-radius: 8px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 0.9rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
}

.role-options input[type="radio"] {
    display: none;
}

.role-options label:has(input[type="radio"]:checked) {
    background: rgba(59, 130, 246, 0.2);
    box-shadow: inset 0 0 0 1px rgba(59, 130, 246, 0.5), 0 0 15px rgba(59, 130, 246, 0.2);
    color: #60A5FA;
}

.role-options label:has(input[type="radio"][value="admin"]:checked) {
    background: rgba(37, 99, 235, 0.2);
    box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.5), 0 0 15px rgba(37, 99, 235, 0.2);
    color: #60A5FA;
}

.auth-wrapper .info-content .logo-container {
    display: flex;
    width: 100%;
    margin-bottom: 20px;
}

.auth-wrapper .info-content.Login .logo-container {
    justify-content: center;
}

.auth-wrapper .info-content.Register .logo-container {
    justify-content: center;
}

.auth-wrapper .info-content .logo-container .cloud-logo svg {
    max-width: 120px;
    max-height: 120px;
}

.auth-wrapper .container .curved-shape {
    position: absolute;
    right: -50px;
    top: -50px;
    height: 700px;
    width: 900px;
    background: linear-gradient(45deg, #0F172A, #3B82F6);
    transform: rotate(10deg) skewY(40deg);
    transform-origin: bottom right;
    transition: 1.5s ease;
    transition-delay: 1.6s;
    z-index: 0;
}

.auth-wrapper .container.active .curved-shape {
    transform: rotate(0deg) skewY(0deg);
    transition-delay: .5s;
}

.auth-wrapper .container .curved-shape2 {
    position: absolute;
    left: 200px;
    top: 100%;
    height: 800px;
    width: 900px;
    background: #0F172A;
    border-top: 3px solid #3B82F6;
    transform: rotate(0deg) skewY(0deg);
    transform-origin: bottom left;
    transition: 1.5s ease;
    transition-delay: .5s;
    z-index: 0;
}

.auth-wrapper .container.active .curved-shape2 {
    transform: rotate(-11deg) skewY(-41deg);
    transition-delay: 1.2s;
}

/* Responsive edits */
@media screen and (max-width: 768px) {
    .auth-wrapper .container {
        width: 100%;
        margin: 0 1rem;
        height: 600px;
    }

    .auth-wrapper .form-box {
        width: 100%;
    }

    .auth-wrapper .info-content {
        display: none;
    }

    .auth-wrapper .form-box.Login {
        padding: 0 20px;
    }

    .auth-wrapper .form-box.Register {
        padding: 0 20px;
    }
}

/* Social Login Integration Styles */
.social-login {
    display: flex;
    flex-direction: row;
    gap: 15px;
    margin-top: 10px;
    width: 100%;
}

.social-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex: 1;
    height: 48px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 15px;
    font-weight: 500;
    color: #fff;
}

.social-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(96, 165, 250, 0.6);
    transform: translateY(-3px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
}

.social-btn box-icon {
    width: 20px;
    height: 20px;
}

.divider {
    display: flex;
    align-items: center;
    text-align: center;
    color: #94A3B8;
    font-size: 11.5px;
    margin: 18px 0 10px 0;
    width: 100%;
}

.divider::before,
.divider::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.divider span {
    padding: 0 15px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
}

.legal-disclaimer {
    margin-top: 15px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.5;
}

.legal-disclaimer a {
    color: #60A5FA;
    text-decoration: none;
    font-weight: 500;
}

.legal-disclaimer a:hover {
    text-decoration: underline;
    text-shadow: 0 0 5px rgba(96, 165, 250, 0.5);
}

/* Mock Google Login Modal Styles */
.google-mock-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
}

.google-mock-modal {
    background: #202124;
    border: 1px solid #3c4043;
    border-radius: 8px;
    padding: 36px 40px;
    width: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 4px 23px 0 rgba(0, 0, 0, 0.4);
}

.google-mock-modal h3 {
    font-size: 24px;
    font-weight: 400;
    margin: 16px 0 8px;
    font-family: 'Google Sans', 'Roboto', Arial, sans-serif;
}

.google-mock-modal p {
    font-size: 16px;
    margin-bottom: 32px;
    font-family: 'Roboto', Arial, sans-serif;
}

.google-mock-modal input {
    width: 100%;
    padding: 13px 15px;
    background: transparent;
    border: 1px solid #5f6368;
    border-radius: 4px;
    color: #e8eaed;
    font-size: 16px;
    margin-bottom: 40px;
}

.google-mock-modal input:focus {
    border: 2px solid #8ab4f8;
    outline: none;
    padding: 12px 14px;
}

.google-mock-actions {
    display: flex;
    justify-content: flex-end;
    gap: 16px;
    width: 100%;
}

.google-text-btn {
    background: transparent;
    border: none;
    color: #8ab4f8;
    font-weight: 500;
    font-size: 14px;
    cursor: pointer;
    padding: 8px 16px;
    border-radius: 4px;
}

.google-text-btn:hover {
    background: rgba(138, 180, 248, 0.08);
}

.google-primary-btn {
    background: #8ab4f8;
    color: #202124;
    border: none;
    font-weight: 500;
    font-size: 14px;
    padding: 8px 24px;
    border-radius: 4px;
    cursor: pointer;
}

.google-primary-btn:hover {
    background: #9ebbff;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
}

@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(30px);
    }

    to {
        opacity: 1;
        transform: translateX(0);
    }
}

.google-mock-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #5f6368;
    border-radius: 16px;
    padding: 4px 8px 4px 6px;
    margin-bottom: 32px;
    cursor: pointer;
    background: transparent;
    transition: background 0.2s ease;
}

.google-mock-chip:hover {
    background: rgba(255, 255, 255, 0.04);
}

.google-mock-chip span {
    font-size: 14px;
    color: #e8eaed;
    font-family: 'Roboto', Arial, sans-serif;
    font-weight: 500;
}

/* Auth Developer Badge */
.auth-footer-badge {
    position: relative;
    margin-top: auto;
    margin-bottom: 15px;
    align-self: center;
    background: rgba(15, 23, 42, 0.4);
    border: 1px solid rgba(59, 130, 246, 0.3);
    padding: 10px 20px;
    border-radius: 30px;
    backdrop-filter: blur(5px);
    width: max-content;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: all 0.3s ease;
    cursor: pointer;
}

.auth-footer-badge:hover {
    background: rgba(15, 23, 42, 0.85);
    border-color: rgba(96, 165, 250, 0.8);
    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
}

.auth-footer-badge p {
    font-size: 13px !important;
    text-shadow: none !important;
    margin: 0;
    color: #94A3B8 !important;
    letter-spacing: 0.5px !important;
    transition: all 0.3s ease;
}

.auth-footer-badge:hover p {
    color: #fff !important;
}

.auth-footer-badge .highlighted-name {
    color: #60A5FA !important;
    font-weight: 700;
    letter-spacing: 1.5px;
    margin-left: 5px;
    text-shadow: 0 0 10px rgba(96, 165, 250, 0.5) !important;
}

.tooltip-details {
    position: absolute;
    bottom: 120%;
    /* Push tooltip above the badge */
    left: 50%;
    transform: translateX(-50%) translateY(10px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    background: rgba(15, 23, 42, 0.95);
    border: 1px solid rgba(59, 130, 246, 0.5);
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    opacity: 0;
    pointer-events: none;
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    white-space: nowrap;
    z-index: 100;
}

/* Tooltip Arrow */
.tooltip-details::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    border-width: 6px 6px 0;
    border-style: solid;
    border-color: rgba(59, 130, 246, 0.5) transparent transparent transparent;
    display: block;
    width: 0;
}

.auth-footer-badge:hover .tooltip-details {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}

.tooltip-details span {
    font-size: 11px;
    color: #cbd5e1;
    letter-spacing: 1px;
}

.tooltip-details .tooltip-id {
    color: #93c5fd;
    font-weight: 600;
    letter-spacing: 2px;
    border-bottom: 2px solid #ef4444;
    /* Add red line under the ID */
    padding-bottom: 2px;
    margin-bottom: 2px;
}

.tooltip-details .tooltip-college {
    font-size: 10px;
    color: #94a3b8;
    margin-top: 2px;
}

/* Adjust developer badge positioning to compensate for the diagonal screen split */
.auth-wrapper .info-content.Login .auth-footer-badge {
    transform: translateX(-45px);
}
`

## File: frontend\src\pages\Auth.jsx
`jsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useGoogleLogin } from '@react-oauth/google';
import Logo from '../components/Logo';
import './Auth.css';

export default function Auth() {
    const location = useLocation();
    const [isActive, setIsActive] = useState(location.pathname === '/register');
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);

    const [regUsername, setRegUsername] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regRole, setRegRole] = useState('user');
    const [error, setError] = useState('');
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showRegPassword, setShowRegPassword] = useState(false);
    const [infoMessage, setInfoMessage] = useState('');
    const [showMockGoogle, setShowMockGoogle] = useState(false);
    const [showMockGooglePassword, setShowMockGooglePassword] = useState(false);
    const [mockEmail, setMockEmail] = useState('varunkumarj23062006@gmail.com');
    const [mockPassword, setMockPassword] = useState('');

    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const { data } = await axios.post('/api/auth/login', {
                email: loginEmail,
                password: loginPassword,
                rememberMe,
            });
            localStorage.setItem('userInfo', JSON.stringify(data));
            navigate('/');
        } catch (err) {
            console.error('Login Detail Error:', err);
            setError(err.response?.data?.message || err.message || 'Login failed');
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            const { data } = await axios.post('/api/auth/register', {
                username: regUsername,
                email: regEmail,
                password: regPassword,
                role: regRole
            });
            localStorage.setItem('userInfo', JSON.stringify(data));
            navigate('/');
        } catch (err) {
            console.error('Registration Detail Error:', err);
            setError(err.response?.data?.message || err.message || 'Registration failed');
        }
    };

    const googleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                // Fetch user info using access token
                const userInfoResponse = await axios.get(
                    'https://www.googleapis.com/oauth2/v3/userinfo',
                    { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
                );

                // Login via backend
                const { data } = await axios.post('/api/auth/social', {
                    email: userInfoResponse.data.email,
                    username: userInfoResponse.data.name,
                    provider: 'Google'
                });

                localStorage.setItem('userInfo', JSON.stringify(data));
                navigate('/');
            } catch (err) {
                setError('Google authentication failed.');
            }
        },
        onError: () => setError('Google Login Failed')
    });

    const handleMockGoogleSubmit = async (e) => {
        e.preventDefault();
        const simulatedName = mockEmail.split('@')[0];
        try {
            const { data } = await axios.post('/api/auth/social', {
                email: mockEmail,
                username: simulatedName,
                provider: 'Google'
            });
            localStorage.setItem('userInfo', JSON.stringify(data));
            setShowMockGoogle(false);
            navigate('/');
        } catch (err) {
            setError('Mock Google Login Failed');
        }
    };

    const handleSocialLogin = async (provider) => {
        if (provider === 'Google') {
            const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
            const isConfigured = clientId && clientId !== 'YOUR_GOOGLE_CLIENT_ID_HERE' && !clientId.includes('dummy');

            if (!isConfigured) {
                // Use the custom mock UI instead of ugly window prompt
                setShowMockGoogle(true);
                return;
            }

            googleLogin();
        } else {
            setInfoMessage(`Simulating secure ${provider} connection... (Requires API Keys)`);
            setTimeout(() => setInfoMessage(''), 3500);
        }
    };

    return (
        <div className="auth-wrapper">
            <div className={`container ${isActive ? 'active' : ''}`}>
                <div className="curved-shape"></div>
                <div className="curved-shape2"></div>

                {error && <div className="error-toast">{error}</div>}
                {infoMessage && <div className="info-toast">{infoMessage}</div>}

                {/* Login Form */}
                <div className="form-box Login">
                    <div className="form-header animation" style={{ '--D': 0, '--S': 21 }}>
                        <box-icon name='lock-alt' type='solid' color='#38bdf8' size='45px' className="header-icon"></box-icon>
                        <h2>Login</h2>
                    </div>
                    <form onSubmit={handleLogin}>
                        <div className="input-box animation" style={{ '--D': 1, '--S': 22 }}>
                            <input type="email" required onChange={(e) => setLoginEmail(e.target.value)} value={loginEmail} />
                            <label>Email Address</label>
                            <box-icon type='solid' name='envelope' color="gray"></box-icon>
                        </div>

                        <div className="input-box animation" style={{ '--D': 2, '--S': 23 }}>
                            <input type={showLoginPassword ? "text" : "password"} required onChange={(e) => setLoginPassword(e.target.value)} value={loginPassword} />
                            <label>Password</label>
                            <box-icon
                                name={showLoginPassword ? 'show' : 'hide'}
                                type='solid'
                                color="gray"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setShowLoginPassword(!showLoginPassword)}
                            ></box-icon>
                        </div>

                        <div className="action-box animation" style={{ '--D': 3, '--S': 24, marginTop: '15px', width: '100%' }}>
                            <div className="form-options" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#ccc' }}>
                                    <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ width: 'auto', marginBottom: 0 }} /> Remember me
                                </label>
                                <a href="#" style={{ color: '#ccc', textDecoration: 'none', fontSize: '0.9rem' }} onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }}>Forgot Password?</a>
                            </div>
                            <button className="btn" type="submit">Login</button>
                        </div>
                    </form>

                    <div className="divider animation" style={{ '--D': 4, '--S': 25 }}>
                        <span>or continue with</span>
                    </div>

                    <div className="social-login animation" style={{ '--D': 5, '--S': 26 }}>
                        <button type="button" className="social-btn" onClick={() => handleSocialLogin('Google')}>
                            <box-icon type='logo' name='google' color="#ea4335"></box-icon> Continue with Google
                        </button>
                    </div>

                    <div className="regi-link animation" style={{ '--D': 6, '--S': 27, width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <p>Don't have an account? <a href="#" className="SignUpLink" onClick={(e) => { e.preventDefault(); setError(''); setIsActive(true); }}>Sign Up</a></p>
                    </div>
                </div>

                <div className="info-content Login">
                    <div className="logo-container animation" style={{ '--D': 0, '--S': 20 }}>
                        <Logo />
                    </div>
                    <h2 className="animation" style={{ '--D': 0, '--S': 20 }}>FILE SHARING <br /> SYSTEM</h2>
                    <p className="animation" style={{ '--D': 1, '--S': 21 }}>Secure Cloud Storage</p>

                    <div className="auth-footer-badge animation" style={{ '--D': 2, '--S': 22 }}>
                        <p>Developed by <span className="highlighted-name">VARUN KUMAR J</span></p>
                        <div className="tooltip-details">
                            <span className="tooltip-id">1U23CS125</span>
                            <span className="tooltip-course">bsc cs</span>
                            <span className="tooltip-college">rvs college of arts and science</span>
                        </div>
                    </div>
                </div>

                {/* Register Form */}
                <div className="form-box Register">
                    <div className="form-header animation" style={{ '--li': 17, '--S': 0 }}>
                        <box-icon name='user-plus' type='solid' color='#38bdf8' size='45px' className="header-icon"></box-icon>
                        <h2>Register</h2>
                    </div>
                    <form onSubmit={handleRegister}>
                        <div className="input-box animation" style={{ '--li': 18, '--S': 1 }}>
                            <input type="text" required onChange={(e) => setRegUsername(e.target.value)} value={regUsername} />
                            <label>Username</label>
                            <box-icon type='solid' name='user' color="gray"></box-icon>
                        </div>

                        <div className="input-box animation" style={{ '--li': 19, '--S': 2 }}>
                            <input type="email" required onChange={(e) => setRegEmail(e.target.value)} value={regEmail} />
                            <label>Email</label>
                            <box-icon name='envelope' type='solid' color="gray"></box-icon>
                        </div>

                        <div className="input-box animation" style={{ '--li': 19, '--S': 3 }}>
                            <input type={showRegPassword ? "text" : "password"} required onChange={(e) => setRegPassword(e.target.value)} value={regPassword} />
                            <label>Password</label>
                            <box-icon
                                name={showRegPassword ? 'show' : 'hide'}
                                type='solid'
                                color="gray"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setShowRegPassword(!showRegPassword)}
                            ></box-icon>
                        </div>

                        <div className="action-box animation" style={{ '--li': 20, '--S': 4, marginTop: '15px', width: '100%' }}>
                            <div className="role-options">
                                <label>
                                    <input type="radio" value="user" checked={regRole === 'user'} onChange={(e) => setRegRole(e.target.value)} />
                                    <box-icon name='user' color={regRole === 'user' ? '#fff' : '#94A3B8'} size="sm"></box-icon>
                                    User
                                </label>
                                <label>
                                    <input type="radio" value="admin" checked={regRole === 'admin'} onChange={(e) => setRegRole(e.target.value)} />
                                    <box-icon name='briefcase-alt-2' color={regRole === 'admin' ? '#fff' : '#94A3B8'} size="sm"></box-icon>
                                    Admin
                                </label>
                            </div>
                            <button className="btn" type="submit">Register</button>
                        </div>
                    </form>

                    <div className="divider animation" style={{ '--li': 21, '--S': 5 }}>
                        <span>or continue with</span>
                    </div>

                    <div className="social-login animation" style={{ '--li': 22, '--S': 6 }}>
                        <button type="button" className="social-btn" onClick={() => handleSocialLogin('Google')}>
                            <box-icon type='logo' name='google' color="#ea4335"></box-icon> Continue with Google
                        </button>
                    </div>

                    <div className="regi-link animation" style={{ '--li': 23, '--S': 7, width: '100%', display: 'flex', justifyContent: 'center' }}>
                        <p>Already have an account? <a href="#" className="SignInLink" onClick={(e) => { e.preventDefault(); setError(''); setIsActive(false); }}>Sign In</a></p>
                    </div>
                </div>

                <div className="info-content Register">
                    <div className="logo-container animation" style={{ '--li': 17, '--S': 0 }}>
                        <Logo />
                    </div>
                    <h2 className="animation" style={{ '--li': 17, '--S': 0 }}>FILE SHARING <br /> SYSTEM</h2>
                    <p className="animation" style={{ '--li': 18, '--S': 1 }}>Secure Cloud Storage</p>
                </div>
            </div>

            {/* Mock Google Login Modal */}
            {showMockGoogle && (
                <div className="google-mock-overlay" onClick={() => setShowMockGoogle(false)}>
                    <div className="google-mock-modal" onClick={e => e.stopPropagation()}>
                        <box-icon type='logo' name='google' color="#ea4335" size="lg"></box-icon>
                        {!showMockGooglePassword ? (
                            <>
                                <h3 style={{ color: '#e8eaed' }}>Sign in</h3>
                                <p style={{ color: '#9aa0a6' }}>to continue to SecureCloud</p>
                                <form onSubmit={(e) => { e.preventDefault(); setShowMockGooglePassword(true); }} style={{ width: '100%', animation: 'slideInRight 0.3s ease-out' }}>
                                    <input
                                        type="email"
                                        value={mockEmail}
                                        onChange={(e) => setMockEmail(e.target.value)}
                                        placeholder="Email or phone"
                                        required
                                        autoFocus
                                    />
                                    <div className="google-mock-actions">
                                        <button type="button" className="google-text-btn" onClick={() => setShowMockGoogle(false)}>Cancel</button>
                                        <button type="submit" className="google-primary-btn">Next</button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            <>
                                <h3 style={{ color: '#e8eaed' }}>Welcome</h3>
                                <div className="google-mock-chip" onClick={() => setShowMockGooglePassword(false)}>
                                    <box-icon name='user-circle' type='solid' color="#9aa0a6"></box-icon>
                                    <span>{mockEmail}</span>
                                    <box-icon name='chevron-down' color="#9aa0a6"></box-icon>
                                </div>
                                <form onSubmit={handleMockGoogleSubmit} style={{ width: '100%', animation: 'slideInRight 0.3s ease-out' }}>
                                    <input
                                        type="password"
                                        value={mockPassword}
                                        onChange={(e) => setMockPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        required
                                        autoFocus
                                    />
                                    <div className="google-mock-actions">
                                        <button type="button" className="google-text-btn" onClick={() => setShowMockGooglePassword(false)}>Forgot password?</button>
                                        <button type="submit" className="google-primary-btn">Sign in</button>
                                    </div>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


`

## File: frontend\src\pages\Dashboard.css
`css
/* PREMIUM DASHBOARD STYLES */
.dashboard-container-new {
    min-height: 100vh;
    background: #0f172a;
    background-image:
        radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.15) 0, transparent 50%),
        radial-gradient(at 100% 0%, rgba(147, 51, 234, 0.15) 0, transparent 50%),
        radial-gradient(at 100% 100%, rgba(219, 39, 119, 0.1) 0, transparent 50%),
        radial-gradient(at 0% 100%, rgba(59, 130, 246, 0.15) 0, transparent 50%);
    color: #f8fafc;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    padding-bottom: 50px;
    padding-top: 10px;
}

.main-full-width {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

/* Glass Panels */
.glass-panel {
    background: rgba(30, 41, 59, 0.5);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4);
    border-radius: 20px;
    padding: 30px;
    margin-bottom: 30px;
}

.glass-card {
    background: rgba(30, 41, 59, 0.7);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 24px;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.glass-card:hover {
    transform: translateY(-5px);
    background: rgba(30, 41, 59, 0.85);
    border-color: rgba(56, 189, 248, 0.4);
}

/* Top Bar */
.top-bar-premium {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 30px;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    margin-bottom: 30px;
    position: sticky;
    top: 15px;
    z-index: 100;
}

.top-left-premium {
    display: flex;
    align-items: center;
    gap: 20px;
}

.logo-compact {
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.header-nav {
    display: flex;
    gap: 10px;
}

.nav-link {
    cursor: pointer;
    padding: 8px 16px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    color: #94a3b8;
    transition: 0.2s;
}

.nav-link.active {
    background: #38bdf8;
    color: #0f172a;
    font-weight: 600;
}

.nav-link:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.05);
}

/* User Profile */
.top-right-premium {
    display: flex;
    align-items: center;
}

.user-section-premium {
    display: flex;
    align-items: center;
    gap: 15px;
}

.avatar-premium {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: 700;
    cursor: pointer;
    transition: 0.3s;
    border: 2px solid rgba(255, 255, 255, 0.2);
}

.avatar-premium:hover {
    transform: scale(1.1);
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
}

/* Cards Grid */
.cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
}

.card h3 {
    font-size: 14px;
    color: #94a3b8;
    margin-bottom: 10px;
}

.card h1 {
    font-size: 32px;
    font-weight: 800;
    margin-bottom: 5px;
    background: linear-gradient(to right, #fff, #94a3b8);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
}

.card p {
    font-size: 12px;
    color: #64748b;
}

/* Upload Box */
.upload-box {
    text-align: center;
    max-width: 600px;
    margin: 0 auto 40px;
}

.security-key-input {
    text-align: left;
    margin: 20px 0;
}

.security-key-input label {
    font-size: 13px;
    color: #94a3b8;
    display: block;
    margin-bottom: 8px;
}

.security-key-input input {
    width: 100%;
    padding: 12px 16px;
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: #38bdf8;
    outline: none;
    font-family: monospace;
}

.file-drop-area {
    border: 2px dashed rgba(56, 189, 248, 0.3);
    border-radius: 16px;
    padding: 40px;
    margin-bottom: 24px;
    transition: 0.2s;
    position: relative;
    cursor: pointer;
}

.file-drop-area:hover {
    background: rgba(56, 189, 248, 0.05);
    border-color: #38bdf8;
}

.file-drop-area input {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
}

.neon-btn {
    background: linear-gradient(135deg, #38bdf8, #818cf8);
    color: #fff;
    border: none;
    padding: 14px 32px;
    border-radius: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: 0.3s;
    box-shadow: 0 4px 20px rgba(56, 189, 248, 0.3);
    width: 100%;
}

.neon-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(56, 189, 248, 0.5);
}

.neon-btn:disabled {
    background: #475569;
    cursor: not-allowed;
    opacity: 0.5;
}

/* Tables */
.table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25px;
}

.search-box-premium {
    display: flex;
    align-items: center;
    background: rgba(15, 23, 42, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 8px 16px;
    border-radius: 12px;
    width: 300px;
}

.search-box-premium input {
    background: transparent;
    border: none;
    color: #fff;
    margin-left: 10px;
    outline: none;
    width: 100%;
    font-size: 14px;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th {
    text-align: left;
    padding: 16px;
    font-size: 13px;
    color: #64748b;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

td {
    padding: 16px;
    font-size: 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.file-row:hover {
    background: rgba(255, 255, 255, 0.02);
}

.file-name-cell {
    display: flex;
    align-items: center;
    gap: 12px;
    font-weight: 500;
}

.status-badge {
    background: rgba(34, 197, 94, 0.1);
    color: #4ade80;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
}

.action-cells {
    display: flex;
    gap: 10px;
}

.download-icon-btn,
.delete-icon-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
    border: none;
    cursor: pointer;
    transition: 0.2s;
}

.download-icon-btn {
    background: rgba(56, 189, 248, 0.15);
}

.download-icon-btn:hover {
    background: #38bdf8;
}

.delete-icon-btn {
    background: rgba(239, 68, 68, 0.15);
}

.delete-icon-btn:hover {
    background: #ef4444;
}

/* Admin Grid */
.admin-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 30px;
}

.role-badge {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
}

.role-badge.admin {
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
}

.role-badge.user {
    background: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
}

.status-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 6px;
}

.status-dot.online {
    background: #22c55e;
    box-shadow: 0 0 8px #22c55e;
}

.gate-authorized {
    color: #22c55e;
    font-weight: 600;
    font-size: 12px;
}

/* Animations */
.fade-in {
    animation: fadeIn 0.8s ease-out forwards;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.progress {
    background: rgba(255, 255, 255, 0.05);
    height: 8px;
    border-radius: 10px;
    margin-bottom: 20px;
    overflow: hidden;
}

.progress-bar {
    height: 100%;
    background: #38bdf8;
    transition: width 0.3s ease;
}

@media (max-width: 768px) {
    .top-bar-premium {
        flex-direction: column;
        gap: 15px;
        top: 10px;
    }

    .header-nav {
        overflow-x: auto;
        width: 100%;
        padding-bottom: 10px;
    }

    .search-box-premium {
        width: 100%;
    }

    .admin-grid {
        grid-template-columns: 1fr;
    }
}
`

## File: frontend\src\pages\Dashboard.jsx
`jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import Footer from '../components/Footer';
import DashboardHero from '../components/DashboardHero';
import axios from 'axios';
import './Dashboard.css';

export default function Dashboard() {
    const [user, setUser] = useState(null);
    const [files, setFiles] = useState([]);
    const [loginHistory, setLoginHistory] = useState([]);
    const [adminUsers, setAdminUsers] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [activeTab, setActiveTab] = useState('Dashboard');
    const [searchQuery, setSearchQuery] = useState('');
    const [securityKey, setSecurityKey] = useState('cloud-secure-2024');
    const [isEncrypting, setIsEncrypting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            const parsedUser = JSON.parse(userInfo);
            setUser(parsedUser);
            fetchFiles(parsedUser.token);
            if (parsedUser.role === 'admin') {
                fetchLoginHistory(parsedUser.token);
                fetchUsers(parsedUser.token);
            }
        } else {
            navigate('/login');
        }
    }, [navigate]);

    const fetchLoginHistory = async (token) => {
        try {
            const { data } = await axios.get('/api/admin/login-history', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLoginHistory(data);
        } catch (err) {
            console.error('Error fetching login history', err);
        }
    };

    const fetchUsers = async (token) => {
        try {
            const { data } = await axios.get('/api/admin/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAdminUsers(data);
        } catch (err) {
            console.error('Error fetching users', err);
        }
    };

    const fetchFiles = async (token) => {
        try {
            const { data } = await axios.get('/api/files', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFiles(data);
        } catch (err) {
            console.error('Error fetching files', err);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('userInfo');
        navigate('/login');
    };

    const handleFileChange = (e) => {
        setSelectedFile(e.target.files[0]);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;
        setIsEncrypting(true);
        setUploadProgress(10);

        try {
            const arrayBuffer = await selectedFile.arrayBuffer();
            const encodedKey = new TextEncoder().encode(securityKey.padEnd(32, '0').slice(0, 32));
            const cryptoKey = await window.crypto.subtle.importKey(
                'raw', encodedKey, { name: 'AES-GCM' }, false, ['encrypt']
            );
            const iv = window.crypto.getRandomValues(new Uint8Array(12));
            const encryptedBuffer = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv }, cryptoKey, arrayBuffer
            );

            setUploadProgress(50);

            const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encryptedBuffer), iv.length);

            const encryptedBlob = new Blob([combined], { type: 'application/octet-stream' });
            const formData = new FormData();
            formData.append('file', encryptedBlob, selectedFile.name + '.enc');

            await axios.post('/api/files', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${user.token}`
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(50 + (percentCompleted / 2));
                }
            });

            fetchFiles(user.token);
            setSelectedFile(null);
            setUploadProgress(0);
        } catch (err) {
            console.error('Upload error', err);
            alert('Encryption or Upload failed. Check your security key.');
        } finally {
            setIsEncrypting(false);
        }
    };

    const handleDownload = async (fileId, filename) => {
        try {
            const response = await axios.get(`/api/files/${fileId}`, {
                headers: { Authorization: `Bearer ${user.token}` },
                responseType: 'arraybuffer'
            });

            const data = new Uint8Array(response.data);
            const iv = data.slice(0, 12);
            const encryptedContent = data.slice(12);

            const encodedKey = new TextEncoder().encode(securityKey.padEnd(32, '0').slice(0, 32));
            const cryptoKey = await window.crypto.subtle.importKey(
                'raw', encodedKey, { name: 'AES-GCM' }, false, ['decrypt']
            );

            const decryptedBuffer = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv }, cryptoKey, encryptedContent
            );

            const url = window.URL.createObjectURL(new Blob([decryptedBuffer]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename.replace('.enc', ''));
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Download error', err);
            alert('Decryption failed. Ensure your Security Key is correct!');
        }
    };

    const handleDelete = async (fileId) => {
        if (!window.confirm("Are you sure you want to delete this file?")) return;
        try {
            await axios.delete(`/api/files/${fileId}`, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            fetchFiles(user.token);
        } catch (err) {
            console.error('Delete error', err);
        }
    };

    if (!user) return null;

    const storageUsedMB = (files.reduce((acc, file) => acc + (file.size || 0), 0) / (1024 * 1024)).toFixed(2);
    const filteredFiles = files.filter(file =>
        file.originalName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="dashboard-container-new">
            <div className="main-full-width fade-in">
                {/* Fixed Premium Header */}
                <div className="top-bar-premium">
                    <div className="top-left-premium">
                        <div className="logo-compact"><Logo /></div>
                        <nav className="header-nav">
                            <span className={activeTab === 'Dashboard' ? 'nav-link active' : 'nav-link'} onClick={() => setActiveTab('Dashboard')}>Overview</span>
                            <span className={activeTab === 'Files' ? 'nav-link active' : 'nav-link'} onClick={() => setActiveTab('Files')}>Storage</span>
                            {user.role === 'admin' && (
                                <span className={activeTab === 'Admin' ? 'nav-link active' : 'nav-link'} onClick={() => setActiveTab('Admin')}>Admin Panel</span>
                            )}
                        </nav>
                    </div>
                    <div className="top-right-premium">
                        <div className="user-section-premium">
                            <div className="welcome-pill">
                                <span>Hello, <strong>{user.username}</strong></span>
                            </div>
                            <div className="avatar-premium" onClick={handleLogout} title="Logout">
                                {user.username.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </div>

                {activeTab === 'Dashboard' && (
                    <>
                        <DashboardHero />
                        <div className="cards">
                            <div className="card glass-card">
                                <h3>Total Cloud Files</h3>
                                <h1>{files.length}</h1>
                                <p>Securely stored</p>
                            </div>
                            <div className="card glass-card">
                                <h3>Storage Consumption</h3>
                                <h1>{storageUsedMB} MB</h1>
                                <p>Used of Unlimited</p>
                            </div>
                            <div className="card glass-card">
                                <h3>Security Status</h3>
                                <h1 style={ { color: '#4ade80', fontSize: '24px' } }>PROTECTED</h1>
                                <p>End-to-End Encrypted</p>
                            </div>
                        </div>

                        {/* Quick Action: Upload */}
                        <div className="upload-box premium-card glass-panel">
                            <h2><box-icon name='cloud-upload' color='#38bdf8' size="lg"></box-icon></h2>
                            <h3>Upload New Secure File</h3>

                            <div className="security-key-input">
                                <label>🔒 Security Key (E2EE):</label>
                                <input
                                    type="password"
                                    value={securityKey}
                                    onChange={(e) => setSecurityKey(e.target.value)}
                                />
                                <small>Your files are encrypted in your browser before being sent to our servers.</small>
                            </div>

                            <div className="file-drop-area">
                                <input type="file" id="fileInput" onChange={handleFileChange} />
                                <label htmlFor="fileInput" className="file-label">
                                    {selectedFile ? selectedFile.name : 'Click to select or drag & drop file'}
                                </label>
                            </div>

                            {uploadProgress > 0 && (
                                <div className="progress">
                                    <div className="progress-bar" style={ { width: `${uploadProgress}%` } }></div>
                                </div>
                            )}

                            <button className="upload-btn neon-btn" onClick={handleUpload} disabled={!selectedFile || isEncrypting}>
                                {isEncrypting ? 'Encrypting...' : 'Secure Upload'}
                            </button>
                        </div>
                    </>
                )}

                {(activeTab === 'Files' || activeTab === 'Dashboard') && (
                    <div className="table-section glass-panel">
                        <div className="table-header">
                            <h3>File Inventory</h3>
                            <div className="search-box-premium">
                                <box-icon name='search' color='#94a3b8' size='18px'></box-icon>
                                <input
                                    type="text"
                                    placeholder="Filter files..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>File Name</th>
                                    <th>Size</th>
                                    <th>Modified</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFiles.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>Your cloud storage is empty.</td>
                                    </tr>
                                ) : (
                                    filteredFiles.map(file => (
                                        <tr key={file._id} className="file-row">
                                            <td className="file-name-cell">
                                                <box-icon name='file-blank' color='#38bdf8' size="sm"></box-icon>
                                                {file.originalName}
                                            </td>
                                            <td>{(file.size / 1024).toFixed(1)} KB</td>
                                            <td>{new Date(file.createdAt).toLocaleDateString()}</td>
                                            <td><span className="status-badge">Encrypted</span></td>
                                            <td className="action-cells">
                                                <button className="download-icon-btn" onClick={() => handleDownload(file._id, file.originalName)} title="Download">
                                                    <box-icon name='download' color='#fff' size="xs"></box-icon>
                                                </button>
                                                {user.role === 'admin' && (
                                                    <button className="delete-icon-btn" onClick={() => handleDelete(file._id)} title="Delete">
                                                        <box-icon name='trash' color='#fff' size="xs"></box-icon>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'Admin' && user.role === 'admin' && (
                    <div className="admin-grid fade-in">
                        <div className="table-section glass-panel">
                            <h3>User Management</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Email</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {adminUsers.map(u => (
                                        <tr key={u._id}>
                                            <td>{u.username}</td>
                                            <td>{u.email}</td>
                                            <td><span className={`role-badge ${u.role}`}>{u.role}</span></td>
                                            <td><span className="status-dot online"></span> Active</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="table-section glass-panel">
                            <h3>Access Logs</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>User Email</th>
                                        <th>Time</th>
                                        <th>Gate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loginHistory.slice(0, 10).map((log, i) => (
                                        <tr key={i}>
                                            <td>{log.email}</td>
                                            <td>{new Date(log.createdAt).toLocaleTimeString()}</td>
                                            <td><span className="gate-authorized">Authorized</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <Footer />
            </div>
        </div>
    );
}

`

## File: frontend\src\pages\ForgotPassword.jsx
`jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import axios from 'axios';
import './Auth.css';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { data } = await axios.post('/api/auth/forgotpassword', { email });
            setMessage(data.message);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Request failed');
            setMessage('');
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="container">
                <div className="curved-shape"></div>
                <div className="curved-shape2"></div>

                <div className="form-box Login">
                    <h2 className="animation" style={{ '--D': 0, '--S': 21 }}>Recovery</h2>

                    {error && <div className="error-toast animation" style={{ '--D': 1, '--S': 21 }}>{error}</div>}
                    {message && <div className="error-toast animation" style={{ '--D': 1, '--S': 21, background: 'rgba(16, 185, 129, 0.9)', borderColor: '#6EE7B7' }}>{message}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="input-box animation" style={{ '--D': 1, '--S': 22 }}>
                            <input type="email" required onChange={(e) => setEmail(e.target.value)} value={email} />
                            <label>Email Address</label>
                            <box-icon type='solid' name='envelope' color="gray"></box-icon>
                        </div>

                        <div className="action-box animation" style={{ '--D': 3, '--S': 24, marginTop: '25px', width: '100%' }}>
                            <button className="btn" type="submit">Send Reset Link</button>
                        </div>

                        <div className="regi-link animation" style={{ '--D': 4, '--S': 25, width: '100%', display: 'flex', justifyContent: 'center' }}>
                            <p>Remember your password? <a href="#" className="SignInLink" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Sign In</a></p>
                        </div>
                    </form>
                </div>

                <div className="info-content Login">
                    <div className="logo-container animation" style={{ '--D': 0, '--S': 20 }}>
                        <Logo />
                    </div>
                    <h2 className="animation" style={{ '--D': 0, '--S': 20 }}>Secure Cloud</h2>
                    <p className="animation" style={{ '--D': 1, '--S': 21 }}>Safe password recovery</p>
                </div>
            </div>
        </div>
    );
}

`

## File: frontend\src\pages\Login.css
`css
.google-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: var(--bg-dark-blue);
    font-family: 'Inter', -apple-system, sans-serif;
}

.google-card {
    background-color: #202124;
    border-radius: 28px;
    padding: 36px 40px;
    width: 448px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    align-items: center;
}

.google-logo {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
}

.google-heading {
    font-size: 24px;
    font-weight: 400;
    color: #e8eaed;
    margin-bottom: 24px;
    text-align: center;
}

.google-account-pill {
    display: flex;
    align-items: center;
    border: 1px solid #5f6368;
    border-radius: 16px;
    padding: 4px 8px 4px 6px;
    cursor: pointer;
    margin-bottom: 32px;
    transition: background-color 0.2s;
}

.google-account-pill:hover {
    background-color: rgba(255, 255, 255, 0.04);
}

.pill-icon {
    width: 20px;
    height: 20px;
    background-color: #1a73e8;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    margin-right: 8px;
}

.pill-icon svg {
    width: 12px;
    height: 12px;
    fill: #fff;
}

.pill-email {
    font-size: 14px;
    color: #e8eaed;
    font-weight: 500;
    margin-right: 8px;
}

.pill-arrow {
    fill: #9aa0a6;
    width: 16px;
    height: 16px;
}

.google-input-group {
    width: 100%;
    margin-bottom: 24px;
    position: relative;
    box-sizing: border-box;
}

.google-input {
    width: 100%;
    background: transparent;
    border: 1px solid #5f6368;
    border-radius: 4px;
    padding: 15px 15px;
    font-size: 16px;
    color: #e8eaed;
    transition: border-color 0.3s, box-shadow 0.3s;
    outline: none;
    box-sizing: border-box;
}

.google-input:focus {
    border-color: #8ab4f8;
    box-shadow: 0 0 0 1px #8ab4f8;
}

.google-input::placeholder {
    color: #9aa0a6;
}

.google-links {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
}

.google-link {
    color: #8ab4f8;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    background: transparent;
    border: none;
    padding: 0;
}

.google-link:hover {
    text-decoration: underline;
}

.google-actions {
    width: 100%;
    display: flex;
    justify-content: flex-end;
    gap: 16px;
}

.google-btn {
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 20px;
    cursor: pointer;
    border: none;
    transition: background-color 0.2s, color 0.2s;
}

.google-btn-cancel {
    background: transparent;
    color: #8ab4f8;
}

.google-btn-cancel:hover {
    background-color: rgba(138, 180, 248, 0.08);
}

.google-btn-submit {
    background-color: #8ab4f8;
    color: #202124;
}

.google-btn-submit:hover {
    background-color: #aecbfa;
    box-shadow: 0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
}

.password-visibility-toggle {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
}

.password-visibility-toggle svg {
    fill: #9aa0a6;
    width: 24px;
    height: 24px;
}
`

## File: frontend\src\pages\Login.jsx
`jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import './Login.css';

export default function Login() {
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleNext = (e) => {
        e.preventDefault();
        if (!email) {
            setError('Enter your email');
            return;
        }
        setError('');
        setStep(2);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const { data } = await axios.post('/api/auth/login', {
                email: email, password, rememberMe: true
            });
            localStorage.setItem('userInfo', JSON.stringify(data));
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please try again.');
        }
    };

    return (
        <div className="google-container">
            <div className="google-card">
                <svg className="google-logo" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>

                {step === 1 ? (
                    <>
                        <h1 className="google-heading" style={{ marginBottom: '8px' }}>Sign in</h1>
                        <p style={{ color: '#e8eaed', marginBottom: '32px', fontSize: '16px' }}>to access your Cloud Files</p>

                        {error && <div style={{ color: '#ff8a80', marginBottom: '16px', fontSize: '14px', width: '100%', textAlign: 'left' }}>{error}</div>}

                        <form onSubmit={handleNext} style={{ width: '100%' }}>
                            <div className="google-input-group">
                                <input
                                    type="email"
                                    className="google-input"
                                    placeholder="Email or phone"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="google-links">
                                <Link to="/forgot-password" className="google-link">Forgot email?</Link>
                            </div>

                            <div className="google-actions">
                                <Link to="/register"><button type="button" className="google-btn google-btn-cancel" style={{ marginRight: 'auto' }}>Create account</button></Link>
                                <button type="submit" className="google-btn google-btn-submit">Next</button>
                            </div>
                        </form>
                    </>
                ) : (
                    <>
                        <h1 className="google-heading" style={{ marginBottom: '16px' }}>Welcome</h1>

                        <div className="google-account-pill" onClick={() => { setStep(1); setError(''); }}>
                            <div className="pill-icon">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                            </div>
                            <span className="pill-email">{email}</span>
                            <svg className="pill-arrow" viewBox="0 0 24 24">
                                <path d="M7 10l5 5 5-5z" />
                            </svg>
                        </div>

                        {error && <div style={{ color: '#ff8a80', marginBottom: '16px', fontSize: '14px', width: '100%', textAlign: 'left' }}>{error}</div>}

                        <form onSubmit={handleLogin} style={{ width: '100%' }}>
                            <div className="google-input-group">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className="google-input"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    className="password-visibility-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" /></svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" /></svg>
                                    )}
                                </button>
                            </div>

                            <div className="google-links">
                                <Link to="/forgot-password" className="google-link">Forgot password?</Link>
                            </div>

                            <div className="google-actions">
                                <button type="button" className="google-btn google-btn-cancel" onClick={() => setStep(1)}>Cancel</button>
                                <button type="submit" className="google-btn google-btn-submit">Sign in</button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}

`

## File: frontend\src\pages\Register.jsx
`jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '../components/Logo';
import axios from 'axios';

export default function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            const { data } = await axios.post('/api/auth/register', {
                username, email, password, role
            });
            localStorage.setItem('userInfo', JSON.stringify(data));
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <Logo />
                    <h2>Create Account</h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Join our secure cloud platform</p>
                </div>

                {error && <div style={{ color: 'var(--error)', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

                <form onSubmit={handleRegister}>
                    <div className="form-group">
                        <label>Username</label>
                        <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="johndoe" />
                    </div>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                    </div>
                    <div className="form-group">
                        <label>Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.8)' }}
                        >
                            <option value="user">Standard User</option>
                            <option value="admin">Administrator</option>
                        </select>
                    </div>

                    <button type="submit" className="btn-primary">Register</button>
                </form>

                <div className="form-footer">
                    Already have an account? <Link to="/login">Sign In</Link>
                </div>
            </div>
        </div>
    );
}

`

## File: frontend\src\pages\ResetPassword.jsx
`jsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Logo from '../components/Logo';
import axios from 'axios';
import './Auth.css';

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const { token } = useParams();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const { data } = await axios.put(`/api/auth/resetpassword/${token}`, { password });
            setMessage(data.message);
            setTimeout(() => navigate('/login'), 3000);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Password reset failed');
            setMessage('');
        }
    };

    return (
        <div className="auth-wrapper">
            <div className="container">
                <div className="curved-shape"></div>
                <div className="curved-shape2"></div>

                <div className="form-box Login">
                    <h2 className="animation" style={{ '--D': 0, '--S': 21 }}>Reset Password</h2>

                    {error && <div className="error-toast animation" style={{ '--D': 1, '--S': 21 }}>{error}</div>}
                    {message && <div className="error-toast animation" style={{ '--D': 1, '--S': 21, background: 'rgba(16, 185, 129, 0.9)', borderColor: '#6EE7B7' }}>{message}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="input-box animation" style={{ '--D': 2, '--S': 23 }}>
                            <input type={showPassword ? "text" : "password"} required onChange={(e) => setPassword(e.target.value)} value={password} />
                            <label>New Password</label>
                            <box-icon
                                name={showPassword ? 'show' : 'hide'}
                                type='solid'
                                color="gray"
                                style={{ cursor: 'pointer' }}
                                onClick={() => setShowPassword(!showPassword)}
                            ></box-icon>
                        </div>

                        <div className="action-box animation" style={{ '--D': 3, '--S': 24, marginTop: '25px', width: '100%' }}>
                            <button className="btn" type="submit">Update Password</button>
                        </div>

                        <div className="regi-link animation" style={{ '--D': 4, '--S': 25, width: '100%', display: 'flex', justifyContent: 'center' }}>
                            <p><a href="#" className="SignInLink" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Back to Sign In</a></p>
                        </div>
                    </form>
                </div>

                <div className="info-content Login">
                    <div className="logo-container animation" style={{ '--D': 0, '--S': 20 }}>
                        <Logo />
                    </div>
                    <h2 className="animation" style={{ '--D': 0, '--S': 20 }}>Secure Cloud</h2>
                    <p className="animation" style={{ '--D': 1, '--S': 21 }}>Enter a strong new password</p>
                </div>
            </div>
        </div>
    );
}

`

## File: frontend\vite.config.mjs
`mjs
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    plugins: [react()],
    root: __dirname,
    server: {
        host: '0.0.0.0',
        port: 5173,
        strictPort: true,
        allowedHosts: true,
        hmr: {
            overlay: false,
        },
        proxy: {
            '/api': { target: 'http://localhost:5000', changeOrigin: true },
            '/uploads': { target: 'http://localhost:5000', changeOrigin: true },
        },
    },
});

`

## File: package.json
`json
{
    "name": "mern-file-sharing-root",
    "private": true,
    "workspaces": [
        "frontend",
        "backend"
    ],
    "engines": {
        "node": ">=18.0.0"
    },
    "packageManager": "npm@10.2.4",
    "devDependencies": {
        "concurrently": "^9.2.1"
    },
    "scripts": {
        "install-all": "npm install && npm install --workspace=backend && npm install --workspace=frontend",
        "dev": "concurrently -n \"BACKEND,FRONTEND\" -c \"blue,green\" \"npm run dev --workspace=backend\" \"npm run dev --workspace=frontend\"",
        "backend": "npm run dev --workspace=backend",
        "frontend": "npm run dev --workspace=frontend",
        "build": "npm run build --workspace=frontend"
    }
}
`

## File: run.bat
`bat
@echo off
title MERN File Sharing App - Launcher
echo ==============================================
echo     Starting MERN Cloud File Sharing App
echo ==============================================
echo.

:: Force injection of Node.js path for the current session (avoids restart requirement)
set PATH=%PATH%;C:\Program Files\nodejs

:: Check if Node is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not recognized in this terminal.
    echo Please restart your computer or Visual Studio Code so the new PATH is applied, then try again!
    pause
    exit
)

echo [1/3] Installing Dependencies...
echo Starting Background Processes...
echo.

:: Start Application (Backend + Frontend)
echo Starting App...
start "MERN App" cmd /k "set PATH=%PATH%;C:\Program Files\nodejs && npm install && npm run dev"
echo ==============================================
echo   Services are starting up!
echo   - Backend will run on http://localhost:5000
echo   - Frontend will open at http://localhost:5173
echo ==============================================
echo.
echo Please wait a few seconds for Vite to compile and open the browser...
timeout /t 5 >nul
start http://localhost:5173
`

## File: share.bat
`bat
@echo off
title Secure Cloud - Public Link Generator
echo ========================================================
echo   Generating Public HTTPS Link for Secure Cloud
echo ========================================================
echo.
echo Instructions:
echo 1. Wait a few seconds for an SSH connection to establish.
echo 2. You will see a green link that looks like: "your url is: https://[random-string].loca.lt"
echo 3. Copy out that EXACT link. That is your Public Sharing Link!
echo 4. Send this link to your friends or open it on your phone.
echo 5. IMPORTANT: Keep this black window OPEN. If you close it, the link dies.
echo.
echo ========================================================
echo   YOUR TUNNEL PASSWORD (REQUIRED FOR FIRST VISIT):
echo ========================================================
curl -s ifconfig.me
echo.
echo.
echo Please give this password to your friend!
echo ========================================================
echo.
echo Starting Tunnel...
call npx -y localtunnel --port 5173
pause

`

## File: stop.bat
`bat
@echo off
title MERN File Sharing App - Stopper
echo ==============================================
echo    Safely Stopping All Services...
echo ==============================================
echo.

:: Kill all node processes (Backend, Frontend, and LocalTunnel)
echo [1/2] Terminating Node.js processes...
taskkill /F /IM node.exe /T >nul 2>&1

:: Kill any stray cmd windows titled with our app names if possible
:: Note: taskkill by title is tricky, but killing node usually stops the heart of the app.

:: Kill localtunnel specifically if it's named separately
echo [2/2] Cleaning up tunnel connections...
taskkill /F /IM lt.exe /T >nul 2>&1

echo.
echo ==============================================
echo   SUCCESS: All services have been stopped.
echo ==============================================
echo.
timeout /t 3
exit

`
{% endraw %}

