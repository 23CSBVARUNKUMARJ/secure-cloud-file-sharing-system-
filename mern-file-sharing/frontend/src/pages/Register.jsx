import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '../components/Logo';
import axios from 'axios';
import './Register.css';

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
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        }
    };

    return (
        <div className="register-container">
            <div className="register-card">
                <div className="register-left">
                    <div className="register-logo-wrapper">
                        <Logo />
                    </div>
                    <h1>WELCOME</h1>
                    <p>Create your secure account and start sharing files with cloud security.</p>
                </div>

                <div className="register-right">
                    <h2>Register</h2>

                    {error && <div className="error-message">{error}</div>}

                    <form className="register-form" onSubmit={handleRegister}>
                        <div className="input-group">
                            <label>Username</label>
                            <input
                                type="text"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Choose a username"
                            />
                        </div>

                        <div className="input-group">
                            <label>Email Address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@company.com"
                            />
                        </div>

                        <div className="input-group">
                            <label>Password</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                            />
                        </div>

                        <div className="input-group">
                            <label>Select Your Role</label>
                            <div className="role-selector">
                                <button
                                    type="button"
                                    className={`role-btn ${role === 'user' ? 'active' : ''}`}
                                    onClick={() => setRole('user')}
                                >
                                    User
                                </button>
                                <button
                                    type="button"
                                    className={`role-btn ${role === 'admin' ? 'active' : ''}`}
                                    onClick={() => setRole('admin')}
                                >
                                    Admin
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="register-btn">Create Account</button>
                    </form>

                    <button className="google-register-btn">
                        <svg width="18" height="18" viewBox="0 0 18 18">
                            <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84c-.21 1.12-.84 2.07-1.79 2.71v2.24h2.91c1.71-1.57 2.68-3.88 2.68-6.6z" />
                            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.24c-.81.54-1.85.86-3.05.86-2.34 0-4.32-1.57-5.02-3.69H.95v2.3C2.43 15.98 5.48 18 9 18z" />
                            <path fill="#FBBC05" d="M3.98 10.75c-.17-.52-.27-1.07-.27-1.64s.1-1.12.27-1.64V5.17H.95C.34 6.38 0 7.75 0 9.17s.34 2.78.95 3.99l3.03-2.41z" />
                            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0 5.48 0 2.43 2.02.95 5.17L3.98 7.47c.7-2.12 2.68-3.69 5.02-3.69z" />
                        </svg>
                        Continue with Google
                    </button>

                    <div className="register-footer">
                        Already have an account? <Link to="/login">Sign In</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
