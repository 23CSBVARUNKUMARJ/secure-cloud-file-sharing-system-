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
            const { data } = await axios.post('/api/auth/forgot-password', { email });
            setMessage(data.message);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Request failed');
            setMessage('');
        }
    };

    return (
        <div className="auth-page-wrapper">
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
