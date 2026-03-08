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
