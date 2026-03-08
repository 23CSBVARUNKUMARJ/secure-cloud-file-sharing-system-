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
