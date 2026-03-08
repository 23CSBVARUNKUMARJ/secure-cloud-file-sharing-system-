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
