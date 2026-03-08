import mongoose from 'mongoose';
import User from './models/User.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/file-sharing-app')
    .then(async () => {
        const users = await User.find({});
        users.forEach(u => console.log(`${u.email} | ${u.role} | ${u.username}`));
        mongoose.disconnect();
    })
    .catch(err => console.error(err));
