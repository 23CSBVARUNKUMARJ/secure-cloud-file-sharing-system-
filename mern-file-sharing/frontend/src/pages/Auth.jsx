import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Logo from '../components/Logo';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import './Auth.css';

export default function Auth() {
    const [isActive, setIsActive] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    // Sync isActive state with URL
    useEffect(() => {
        if (location.pathname === '/register') {
            setIsActive(true);
        } else {
            setIsActive(false);
        }
    }, [location.pathname]);

    // LOGIN FORM STATE
    const [loginData, setLoginData] = useState({ email: '', password: '' });
    const [loginError, setLoginError] = useState('');
    const [loginStep, setLoginStep] = useState(1);

    // REGISTER FORM STATE
    const [regData, setRegData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'user'
    });
    const [regError, setRegError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showDevPopup, setShowDevPopup] = useState(false);
    const [showAbout, setShowAbout] = useState(false);
    const [showPricing, setShowPricing] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
    const [isLightMode, setIsLightMode] = useState(localStorage.getItem('theme') === 'light');

    const triggerToast = (msg, type = 'success') => {
        setToast({ show: true, message: msg, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
    };

    // Theme Toggle Logic
    useEffect(() => {
        if (isLightMode) {
            document.body.classList.add('light-theme');
            localStorage.setItem('theme', 'light');
        } else {
            document.body.classList.remove('light-theme');
            localStorage.setItem('theme', 'dark');
        }
    }, [isLightMode]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');

        if (loginStep === 1) {
            try {
                const { data } = await axios.post('/api/auth/check-email', { email: loginData.email });
                if (data.exists) {
                    setLoginStep(2);
                } else {
                    setRegData({ ...regData, email: loginData.email });
                    triggerToast('Email not found. Redirecting you to Register.', 'info');
                    toggleForm(true); // Switch to Register
                }
            } catch (err) {
                setLoginError('Could not verify email. Is the server running?');
            }
            return;
        }

        try {
            const { data } = await axios.post('/api/auth/login', loginData);
            localStorage.setItem('userInfo', JSON.stringify(data));
            navigate('/');
        } catch (err) {
            setLoginError(err.response?.data?.message || 'Login failed. Please try again.');
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setRegError('');
        try {
            await axios.post('/api/auth/register', regData);
            setRegError('');
            triggerToast('Registration Successful! You can now login.', 'success');
            toggleForm(false); // Switch to Login view
        } catch (err) {
            setRegError(err.response?.data?.message || 'Registration failed. Please try again.');
        }
    };
    const handleGoogleSuccess = async (credentialResponse) => {
        try {
            const isAdmin = credentialResponse.credential === "MOCK_TOKEN_SUCCESS";
            const payload = isAdmin
                ? { email: 'varunkumarj23062006@gmail.com', username: 'System Admin', provider: 'google', role: 'admin' }
                : { tokenId: credentialResponse.credential };

            const { data } = await axios.post('/api/auth/social', payload);

            if (data.isNewUser) {
                triggerToast('Google Account Linked! Please sign in to verify.', 'success');
                toggleForm(false);
            } else {
                localStorage.setItem('userInfo', JSON.stringify(data));
                navigate('/');
            }
        } catch (err) {
            console.error('Google Auth Error:', err);
            const msg = err.response?.data?.message || 'Connection to Cloud Servers Failed. Is the backend running?';
            setLoginError(msg);
        }
    };

    const toggleForm = (isReg) => {
        setIsActive(isReg);
        setLoginStep(1);
        navigate(isReg ? '/register' : '/login');
    };

    return (
        <div className="auth-page-wrapper">
            {/* Top Navigation Bar */}
            <div className="auth-top-navbar">
                <div className="auth-nav-links">
                    <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="nav-link-premium">
                        <i className="fas fa-home"></i> Home
                    </a>
                    <a href="#about" onClick={(e) => { e.preventDefault(); setShowAbout(true); }} className="nav-link-premium">About</a>
                    <a href="#pricing" onClick={(e) => { e.preventDefault(); setShowPricing(true); }} className="nav-link-premium">Pricing</a>
                </div>
                <div className="theme-toggle-switch" onClick={() => setIsLightMode(!isLightMode)}>
                    <i className={`fas ${isLightMode ? 'fa-sun' : 'fa-moon'}`}></i>
                    <span>{isLightMode ? 'Light Mode' : 'Dark Mode'}</span>
                </div>
            </div>

            <div className={`container ${isActive ? 'active' : ''}`}>
                <div className="curved-shape"></div>
                <div className="curved-shape2"></div>

                {/* LOGIN FORM BOX */}
                <div className="form-box Login">
                    <div className="form-header-premium animation" style={{ "--D": 0, "--S": 21 }}>
                        <div className="form-logo-top">
                            <Logo />
                        </div>
                        <h2>Login</h2>
                    </div>

                    <form onSubmit={handleLogin}>
                        <div className="inputBox animation" style={{ "--D": 1, "--S": 22 }}>
                            <i className="fa fa-envelope"></i>
                            <input
                                type="email"
                                placeholder="Email Address"
                                required
                                value={loginData.email}
                                onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                                disabled={loginStep === 2}
                            />
                        </div>

                        {loginStep === 2 && (
                            <div className="inputBox animation" style={{ "--D": 2, "--S": 23 }}>
                                <i className="fa fa-lock"></i>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    required
                                    value={loginData.password}
                                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                                    autoFocus
                                />
                                <i
                                    className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'} show`}
                                    onClick={() => setShowPassword(!showPassword)}
                                ></i>
                            </div>
                        )}

                        {loginError && <p className="error-msg animation" style={{ "--D": 2.5, "--S": 23.5, color: '#ff4444', fontSize: '12px', marginTop: '10px' }}>{loginError}</p>}

                        <div className="animation" style={{ "--D": 3, "--S": 24 }}>
                            <button className="btn" type="submit">
                                {loginStep === 1 ? 'Next' : 'Login'}
                            </button>
                        </div>

                        <div className="google-login-row animation" style={{ "--D": 3.5, "--S": 24.5 }}>
                            <div className="divider"><span>or</span></div>
                            {(!import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID.includes('dummy')) ? (
                                <button
                                    className="btn simulation-google-btn"
                                    type="button"
                                    onClick={() => {
                                        handleGoogleSuccess({ credential: "MOCK_TOKEN_SUCCESS" });
                                    }}
                                >
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" style={{ width: '16px' }} />
                                    Sign in with Google
                                </button>
                            ) : (
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess}
                                    onError={() => setLoginError('Login failed')}
                                    theme="filled_blue"
                                    shape="pill"
                                    size="medium"
                                    width="100%"
                                />
                            )}
                        </div>

                        <div className="regi-link animation" style={{ "--D": 4, "--S": 25 }}>
                            <p>Don't have an account? <br />
                                <a href="#" onClick={(e) => { e.preventDefault(); toggleForm(true); }} className="SignUpLink">Sign Up</a>
                            </p>
                        </div>
                    </form>
                </div>

                {/* WELCOME BACK INFO */}
                <div className="info-content Login">
                    <h2 className="animation" style={{ "--D": 0, "--S": 20 }}>WELCOME BACK!</h2>
                    <p className="animation" style={{ "--D": 1, "--S": 21 }}>
                        Secure Cloud File Sharing System.
                    </p>
                </div>

                {/* REGISTER FORM BOX */}
                <div className="form-box Register">
                    <div className="form-header-premium animation" style={{ "--li": 17, "--S": 0 }}>
                        <div className="form-logo-top">
                            <Logo />
                        </div>
                        <h2>Register</h2>
                    </div>

                    <form onSubmit={handleRegister}>
                        <div className="inputBox animation" style={{ "--li": 18, "--S": 1 }}>
                            <i className="fa fa-user"></i>
                            <input
                                type="text"
                                placeholder="Username"
                                required
                                value={regData.username}
                                onChange={(e) => setRegData({ ...regData, username: e.target.value })}
                            />
                        </div>

                        <div className="inputBox animation" style={{ "--li": 19, "--S": 2 }}>
                            <i className="fa fa-envelope"></i>
                            <input
                                type="email"
                                placeholder="Email Address"
                                required
                                value={regData.email}
                                onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                            />
                        </div>

                        <div className="inputBox animation" style={{ "--li": 19, "--S": 3 }}>
                            <i className="fa fa-lock"></i>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                required
                                value={regData.password}
                                onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                            />
                            <i
                                className={`fa ${showPassword ? 'fa-eye-slash' : 'fa-eye'} show`}
                                onClick={() => setShowPassword(!showPassword)}
                            ></i>
                        </div>

                        <div className="inputBox animation" style={{ "--li": 19, "--S": 4 }}>
                            <i className="fa fa-users-cog"></i>
                            <select
                                className="styled-select"
                                value={regData.role}
                                onChange={(e) => setRegData({ ...regData, role: e.target.value })}
                            >
                                <option value="user">Standard User</option>
                                <option value="admin">System Admin</option>
                            </select>
                        </div>

                        {regError && <p className="error-msg animation" style={{ "--li": 20.5, "--S": 4.5, color: '#ff4444', fontSize: '12px', marginTop: '10px' }}>{regError}</p>}

                        <div className="animation" style={{ "--li": 20, "--S": 4 }}>
                            <button className="btn" type="submit">Create Account</button>
                        </div>

                        <div className="google-login-row animation" style={{ "--li": 20.5, "--S": 4.5 }}>
                            <div className="divider"><span>or</span></div>
                            {(!import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID.includes('dummy')) ? (
                                <button
                                    className="btn simulation-google-btn"
                                    type="button"
                                    onClick={() => handleGoogleSuccess({ credential: "MOCK_TOKEN_SUCCESS" })}
                                >
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google" />
                                    Sign in with Google
                                </button>
                            ) : (
                                <GoogleLogin
                                    onSuccess={handleGoogleSuccess}
                                    theme="filled_blue"
                                    shape="pill"
                                    size="medium"
                                    width="100%"
                                />
                            )}
                        </div>

                        <div className="regi-link animation" style={{ "--li": 21, "--S": 5 }}>
                            <p>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); toggleForm(false); }} className="SignInLink">Sign In</a></p>
                        </div>
                    </form>
                </div>

                {/* WELCOME INFO */}
                <div className="info-content Register">
                    <h2 className="animation" style={{ "--li": 17, "--S": 0 }}>JOIN CLOUD SECURE!</h2>
                    <p className="animation" style={{ "--li": 18, "--S": 1 }}>
                        Experience Tier-1 end-to-end encryption for all your sensitive files.
                    </p>
                </div>
            </div>

            {/* Premium Developer Badge & Popup */}
            <div className={`dev-badge-container ${showDevPopup ? 'active' : ''}`} onClick={() => setShowDevPopup(!showDevPopup)}>
                <div className="dev-badge">
                    <i className={`fas ${showDevPopup ? 'fa-times' : 'fa-user-shield'}`}></i>
                </div>
                {showDevPopup && (
                    <div className="dev-popup-overlay" onClick={(e) => { e.stopPropagation(); setShowDevPopup(false); }}>
                        <div className="dev-popup-card" onClick={(e) => e.stopPropagation()}>
                            <div className="dev-popup-icon">
                                <i className="fas fa-terminal"></i>
                            </div>
                            <h3>System Core</h3>
                            <p className="dev-text">DEVELOPED BY</p>
                            <h2 className="dev-name">VARUN KUMAR J</h2>
                            <div className="dev-status">
                                <span className="status-dot"></span>
                                PROJECT ADMIN
                            </div>
                            <button className="dev-close-btn" onClick={() => setShowDevPopup(false)}>CLOSE</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Premium About Popup */}
            {showAbout && (
                <div className="dev-popup-overlay" onClick={() => setShowAbout(false)}>
                    <div className="dev-popup-card about-card" onClick={(e) => e.stopPropagation()}>
                        <div className="dev-popup-icon"><i className="fas fa-info-circle"></i></div>
                        <h2>About CloudSecure</h2>
                        <div className="about-content">
                            <p>CloudSecure is a next-generation file sharing platform built with a "Security First" philosophy.</p>
                            <ul className="feature-list-premium">
                                <li><i className="fas fa-microchip"></i> AES-256-GCM Encryption</li>
                                <li><i className="fas fa-user-shield"></i> Zero-Knowledge Architecture</li>
                                <li><i className="fas fa-bolt"></i> Real-time Secure Transfers</li>
                                <li><i className="fas fa-fingerprint"></i> IAM Access Control</li>
                                <li><i className="fas fa-atom"></i> Quantum-Safe Security</li>
                            </ul>
                        </div>
                        <button className="dev-close-btn" onClick={() => setShowAbout(false)}>UNDERSTOOD</button>
                    </div>
                </div>
            )}

            {/* Premium Pricing Popup */}
            {showPricing && (
                <div className="dev-popup-overlay" onClick={() => setShowPricing(false)}>
                    <div className="dev-popup-card pricing-card" onClick={(e) => e.stopPropagation()}>
                        <div className="dev-popup-icon"><i className="fas fa-tags"></i></div>
                        <h2>Our Plans</h2>
                        <div className="pricing-grid-premium">
                            <div className="price-box">
                                <h4>STARTER</h4>
                                <h3>Free</h3>
                                <p>15GB Cloud Storage</p>
                                <div className="pricing-divider"></div>
                                <span className="spec-text">90-Day Trial Period</span>
                            </div>
                            <div className="price-box featured">
                                <h4>PROFESSIONAL</h4>
                                <h3>$19<span>/mo</span></h3>
                                <p>1TB Secure Vault</p>
                                <div className="pricing-divider"></div>
                                <span className="spec-text">Advanced Security Pack</span>
                            </div>
                            <div className="price-box">
                                <h4>ENTERPRISE</h4>
                                <h3>Custom</h3>
                                <p>Unlimited Capacity</p>
                                <div className="pricing-divider"></div>
                                <span className="spec-text">Pay-as-you-go Billing</span>
                            </div>
                        </div>
                        <button className="dev-close-btn" onClick={() => setShowPricing(false)}>DISMISS</button>
                    </div>
                </div>
            )}

            {/* Premium Custom Toast */}
            {toast.show && (
                <div className={`toast-container-premium ${toast.type}`}>
                    <div className="toast-icon">
                        {toast.type === 'success' ? <i className="fas fa-check-circle"></i> :
                            toast.type === 'error' ? <i className="fas fa-exclamation-triangle"></i> :
                                <i className="fas fa-info-circle"></i>}
                    </div>
                    <div className="toast-message">{toast.message}</div>
                </div>
            )}
        </div>
    );
}
