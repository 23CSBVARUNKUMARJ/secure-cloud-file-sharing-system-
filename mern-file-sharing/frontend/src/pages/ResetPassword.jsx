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
            const { data } = await axios.put(`/api/auth/reset-password/${token}`, { password });
            setMessage(data.message);
            setTimeout(() => navigate('/login'), 3000);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Password reset failed');
            setMessage('');
        }
    };

    return (
        <div className="auth-page-wrapper">
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
