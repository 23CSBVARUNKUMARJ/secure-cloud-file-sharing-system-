import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const UserSchema = new mongoose.Schema({
    username: String,
    email: String,
    role: String
});
const User = mongoose.model('User', UserSchema);

async function checkUsers() {
    console.log('Starting checkUsers script...');
    try {
        console.log('Connecting to:', process.env.MONGO_URI);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected.');
        const users = await User.find({});
        console.log('Total Users:', users.length);
        console.log('Users:', users.map(u => ({ email: u.email, role: u.role, username: u.username })));
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkUsers();
