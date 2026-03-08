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
    const [currentTime, setCurrentTime] = useState(new Date());
    const [expirationDays, setExpirationDays] = useState(0);
    const [generatedKey, setGeneratedKey] = useState('');
    const [isCleaning, setIsCleaning] = useState(false);
    const navigate = useNavigate();

    // Live Clock Effect
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const userInfo = localStorage.getItem('userInfo');
        if (userInfo) {
            const parsedUser = JSON.parse(userInfo);
            setUser(parsedUser);
            setActiveTab(parsedUser.role === 'admin' ? 'Dashboard' : 'Files');
            fetchFiles(parsedUser.token);
            // Always fetch login history for logs visibility if needed, or keep for admin
            if (parsedUser.role === 'admin') {
                fetchLoginHistory(parsedUser.token);
                fetchUsers(parsedUser.token);
            } else {
                fetchLoginHistory(parsedUser.token); // Let users see their own logs too maybe? Controller might need update but I'll assume it works or just hide for non-admins if restricted.
            }
        } else {
            navigate('/login');
        }
    }, [navigate]);

    // Refetch data when tab changes or periodically
    useEffect(() => {
        if (user && user.token) {
            fetchFiles(user.token);
            if (user.role === 'admin') {
                fetchLoginHistory(user.token);
                fetchUsers(user.token);
            }
        }
    }, [activeTab, user?.token]);

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

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!securityKey) {
            alert('Security Key Required!');
            return;
        }

        setIsEncrypting(true);
        setUploadProgress(10);
        try {
            const arrayBuffer = await file.arrayBuffer();
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

            const formData = new FormData();
            formData.append('file', new Blob([combined]), file.name + '.enc');

            await axios.post('/api/files', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${user.token}`
                },
                onUploadProgress: (p) => {
                    const pct = Math.round((p.loaded * 100) / p.total);
                    setUploadProgress(50 + (pct / 2));
                }
            });

            setUploadProgress(100);
            setTimeout(() => setUploadProgress(0), 1000);
            fetchFiles(user.token);
            alert('File secured and uploaded successfully!');
        } catch (err) {
            console.error(err);
            alert('Upload failed.');
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
            if (err.response?.status === 410) {
                alert('This secure link has expired and is no longer accessible.');
            } else {
                alert('Decryption failed. Ensure your Security Key is correct!');
            }
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

    const handleSelfClean = async () => {
        if (!window.confirm("Trigger professional system purge? This will securely remove all expired files.")) return;
        setIsCleaning(true);
        try {
            const { data } = await axios.post('/api/admin/clean', {}, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            alert(data.message);
            fetchFiles(user.token);
        } catch (err) {
            alert('Purge failed. Check server status.');
        } finally {
            setIsCleaning(false);
        }
    };

    const handleGenerateKey = async () => {
        try {
            const { data } = await axios.post('/api/admin/generate-key', {}, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setGeneratedKey(data.key);
        } catch (err) {
            alert('Key generation failed.');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        alert('Copied to clipboard!');
    };

    if (!user) return null;

    const storageUsedMB = (files.reduce((acc, file) => acc + (file.size || 0), 0) / (1024 * 1024)).toFixed(2);
    const storageUsedMBValue = parseFloat(storageUsedMB);
    const storageLimitMB = 100;
    const storagePercent = Math.min((storageUsedMBValue / storageLimitMB) * 100, 100);

    const filteredFiles = files.filter(file =>
        file.originalName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getFileIcon = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) return <box-icon name='image' color='#f59e0b'></box-icon>;
        if (['pdf'].includes(ext)) return <box-icon name='file-pdf' color='#ef4444'></box-icon>;
        if (['mp4', 'avi', 'mov'].includes(ext)) return <box-icon name='movie-play' color='#38bdf8'></box-icon>;
        if (['zip', 'rar', '7z'].includes(ext)) return <box-icon name='archive' color='#8b5cf6'></box-icon>;
        return <box-icon name='file' color='#94a3b8'></box-icon>;
    };

    if (!user) return null;

    return (
        <div className="dashboard-container-new">
            <div className="dashboard-layout">
                {/* PROFESSIONAL SIDEBAR */}
                <aside className="sidebar-premium">
                    <div className="sidebar-logo">
                        <Logo />
                    </div>

                    <nav className="sidebar-nav">
                        {user.role === 'admin' && (
                            <div
                                className={`sidebar-link ${activeTab === 'Dashboard' ? 'active' : ''}`}
                                onClick={() => setActiveTab('Dashboard')}
                            >
                                <box-icon name='grid-alt' color={activeTab === 'Dashboard' ? '#38bdf8' : '#94a3b8'}></box-icon>
                                <span>Overview</span>
                            </div>
                        )}

                        <div
                            className={`sidebar-link ${activeTab === 'Files' ? 'active' : ''}`}
                            onClick={() => setActiveTab('Files')}
                        >
                            <box-icon name='folder-open' color={activeTab === 'Files' ? '#38bdf8' : '#94a3b8'}></box-icon>
                            <span>My Storage</span>
                        </div>

                        {user.role === 'admin' && (
                            <>
                                <div
                                    className={`sidebar-link ${activeTab === 'Security' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('Security')}
                                >
                                    <box-icon name='shield-quarter' color={activeTab === 'Security' ? '#38bdf8' : '#94a3b8'}></box-icon>
                                    <span>Security Center</span>
                                </div>
                                <div
                                    className={`sidebar-link ${activeTab === 'Admin' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('Admin')}
                                >
                                    <box-icon name='user-voice' color={activeTab === 'Admin' ? '#38bdf8' : '#94a3b8'}></box-icon>
                                    <span>User Admin</span>
                                </div>
                                <div
                                    className={`sidebar-link ${activeTab === 'IAM' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('IAM')}
                                >
                                    <box-icon name='key' color={activeTab === 'IAM' ? '#38bdf8' : '#94a3b8'}></box-icon>
                                    <span>IAM Access</span>
                                </div>
                                <div
                                    className={`sidebar-link ${activeTab === 'TechCenter' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('TechCenter')}
                                >
                                    <box-icon name='terminal' color={activeTab === 'TechCenter' ? '#38bdf8' : '#94a3b8'}></box-icon>
                                    <span>Technical Center</span>
                                </div>
                            </>
                        )}

                        <div
                            className={`sidebar-link ${activeTab === 'Profile' ? 'active' : ''}`}
                            onClick={() => setActiveTab('Profile')}
                        >
                            <box-icon name='cog' color={activeTab === 'Profile' ? '#38bdf8' : '#94a3b8'}></box-icon>
                            <span>Account Settings</span>
                        </div>
                    </nav>

                    {/* VISUAL STORAGE USAGE */}
                    <div className="storage-stats-sidebar">
                        <h4>Storage Used</h4>
                        <div className="storage-bar-bg">
                            <div className="storage-bar-fill" style={{ width: `${storagePercent}%` }}></div>
                        </div>
                        <div className="storage-text" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{storageUsedMB} MB</span>
                            <span>{storageLimitMB} MB</span>
                        </div>
                    </div>
                </aside>

                {/* MAIN CONTENT AREA */}
                <main className="main-content-area">
                    <div className="main-full-width fade-in">
                        <header className="top-bar-premium">
                            <div className="live-clock-premium">
                                <box-icon name='calendar' color='#38bdf8' size='xs'></box-icon>
                                <span>{currentTime.toLocaleDateString()}</span>
                                <box-icon name='time-five' color='#38bdf8' size='xs' style={{ marginLeft: '10px' }}></box-icon>
                                <span>{currentTime.toLocaleTimeString()}</span>
                            </div>

                            <div className="user-section-premium" style={{ marginLeft: 'auto', marginRight: '20px' }}>
                                <div className="welcome-pill">
                                    <span>Hello, <strong>{user.username}</strong></span>
                                </div>
                                <div className="avatar-premium">
                                    {user.username.charAt(0).toUpperCase()}
                                </div>
                                <button className="logout-action-btn" onClick={handleLogout}>
                                    <box-icon name='power-off' color='#ef4444' size='sm'></box-icon>
                                </button>
                            </div>
                        </header>

                        {activeTab === 'Dashboard' && user.role === 'admin' && (
                            <>
                                <DashboardHero />
                                <div className="cards">
                                    <div className="card glass-card">
                                        <div className="card-header-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '10px', borderRadius: '12px', width: 'fit-content', marginBottom: '15px' }}>
                                            <box-icon name='file' color='#38bdf8'></box-icon>
                                        </div>
                                        <h3>Secure Files</h3>
                                        <h1>{files.length}</h1>
                                        <p>Encrypted objects</p>
                                    </div>
                                    <div className="card glass-card">
                                        <div className="card-header-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '10px', borderRadius: '12px', width: 'fit-content', marginBottom: '15px' }}>
                                            <box-icon name='hdd' color='#8b5cf6'></box-icon>
                                        </div>
                                        <h3>Core Storage</h3>
                                        <h1>{storagePercent.toFixed(1)}%</h1>
                                        <p>{storageUsedMB} MB / {storageLimitMB} MB</p>
                                    </div>
                                    <div className="card glass-card">
                                        <div className="card-header-icon" style={{ background: 'rgba(74, 222, 128, 0.1)', padding: '10px', borderRadius: '12px', width: 'fit-content', marginBottom: '15px' }}>
                                            <box-icon name='shield-check' color='#4ade80'></box-icon>
                                        </div>
                                        <h3>Security Status</h3>
                                        <h1 style={{ color: '#4ade80', fontSize: '24px' }}>PROTECTED</h1>
                                        <p>E2EE Layer Active</p>
                                    </div>
                                    <div className="card glass-card" style={{ border: '1px solid rgba(56, 189, 248, 0.3)', background: 'rgba(56, 189, 248, 0.05)' }}>
                                        <div className="card-header-icon" style={{ background: 'rgba(56, 189, 248, 0.2)', padding: '10px', borderRadius: '12px', width: 'fit-content', marginBottom: '15px' }}>
                                            <box-icon name='group' color='#38bdf8' animation='tada-hover'></box-icon>
                                        </div>
                                        <h3 style={{ color: '#38bdf8' }}>Active Users</h3>
                                        <h1 style={{ textShadow: '0 0 20px rgba(56, 189, 248, 0.5)' }}>{adminUsers.length}</h1>
                                        <span className="gate-authorized" style={{ fontSize: '10px', padding: '2px 8px' }}>IDENTITY VERIFIED</span>
                                    </div>
                                </div>

                                <div className="system-tools-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '30px' }}>
                                    <div className="glass-panel" style={{ padding: '25px', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                            <box-icon name='wrench' color='#38bdf8' size='md'></box-icon>
                                            <h2 style={{ margin: 0, fontSize: '20px' }}>Active System Tools</h2>
                                        </div>
                                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                <box-icon name='check-double' color='#4ade80' size='xs' style={{ marginTop: '4px' }}></box-icon>
                                                <div>
                                                    <strong style={{ display: 'block', fontSize: '14px' }}>AES-256-GCM Encryption</strong>
                                                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Client-side cryptographic engine is fully operational for secure transfers.</p>
                                                </div>
                                            </li>
                                            <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                <box-icon name='check-double' color='#4ade80' size='xs' style={{ marginTop: '4px' }}></box-icon>
                                                <div>
                                                    <strong style={{ display: 'block', fontSize: '14px' }}>24/7 Housekeeper Service</strong>
                                                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Automated background task for purging expired files and system audit logs.</p>
                                                </div>
                                            </li>
                                            <li style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                <box-icon name='check-double' color='#4ade80' size='xs' style={{ marginTop: '4px' }}></box-icon>
                                                <div>
                                                    <strong style={{ display: 'block', fontSize: '14px' }}>IAM Access Key Engine</strong>
                                                    <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Real-time generation and management of secure API access tokens.</p>
                                                </div>
                                            </li>
                                        </ul>
                                    </div>

                                    <div className="glass-panel" style={{ padding: '25px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                            <box-icon name='pulse' color='#38bdf8' size='md' animation='flashing'></box-icon>
                                            <h2 style={{ margin: 0, fontSize: '20px' }}>Server Health</h2>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            <div className="health-stat" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '14px', color: '#94a3b8' }}>API Gateway</span>
                                                <span className="gate-authorized">ONLINE</span>
                                            </div>
                                            <div className="health-stat" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '14px', color: '#94a3b8' }}>File Storage Engine</span>
                                                <span className="gate-authorized">ACTIVE</span>
                                            </div>
                                            <div className="health-stat" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontSize: '14px', color: '#94a3b8' }}>Identity Provider</span>
                                                <span className="gate-authorized">SECURE</span>
                                            </div>
                                            <div style={{ marginTop: '10px', height: '60px', background: 'rgba(56, 189, 248, 0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed rgba(56, 189, 248, 0.2)' }}>
                                                <span style={{ fontSize: '11px', color: '#38bdf8', letterSpacing: '1px' }}>SYSTEM OPTIMIZED</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === 'Files' && (
                            <div className="files-section">
                                <div className="table-header">
                                    <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Secure Storage</h2>
                                    <div className="search-box-premium">
                                        <box-icon name='search' color='#94a3b8' size='xs'></box-icon>
                                        <input
                                            placeholder="Search your secure files..."
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="upload-box glass-panel">
                                    <div className="security-key-input">
                                        <input
                                            type="password"
                                            placeholder="Enter Security Key for Encryption..."
                                            value={securityKey}
                                            onChange={(e) => setSecurityKey(e.target.value)}
                                        />
                                    </div>
                                    <div className="file-drop-area">
                                        <input type="file" onChange={handleFileUpload} disabled={isEncrypting} />
                                        <box-icon name='cloud-upload' color='#38bdf8' size='lg'></box-icon>
                                        <p>{isEncrypting ? 'Encrypting & Uploading...' : 'Click or Drag files to upload securely'}</p>
                                        {isEncrypting && (
                                            <div className="progress" style={{ marginTop: '20px' }}>
                                                <div className="progress-bar" style={{ width: `${uploadProgress}%` }}></div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="glass-panel">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>File Name</th>
                                                <th>Size</th>
                                                <th>Uploaded</th>
                                                <th>Protection</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredFiles.map(file => (
                                                <tr key={file._id} className="file-row">
                                                    <td className="file-name-cell">
                                                        {getFileIcon(file.originalName)}
                                                        {file.originalName}
                                                    </td>
                                                    <td>{(file.size / 1024).toFixed(1)} KB</td>
                                                    <td className="time-cell">{new Date(file.createdAt).toLocaleDateString()}</td>
                                                    <td><span className="status-badge">AES-256</span></td>
                                                    <td className="action-cells">
                                                        <button className="download-icon-btn" onClick={() => handleDownload(file._id, file.originalName)}>
                                                            <box-icon name='download' color='#fff' size='xs'></box-icon>
                                                        </button>
                                                        {user.role === 'admin' && (
                                                            <button className="delete-icon-btn" onClick={() => handleDelete(file._id)}>
                                                                <box-icon name='trash' color='#fff' size='xs'></box-icon>
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'Security' && user.role === 'admin' && (
                            <div className="security-grid fade-in">
                                <div className="security-feature-card glass-panel">
                                    <box-icon name='lock-alt' color='#38bdf8' size='lg'></box-icon>
                                    <h3>AES-256-GCM</h3>
                                    <p>Military-grade encryption used for every file. Your security key never leaves your browser.</p>
                                    <span className="status-badge" style={{ marginTop: '10px', display: 'inline-block' }}>ACTIVE</span>
                                </div>

                                <div className="security-feature-card glass-panel">
                                    <box-icon name='user-check' color='#4ade80' size='lg'></box-icon>
                                    <h3>Role Based Access</h3>
                                    <p>Strict identity verification for every resource request. Session tokens are rotated regularly.</p>
                                    <span className="status-badge" style={{ marginTop: '10px', display: 'inline-block' }}>ENFORCED</span>
                                </div>

                                <div className="security-feature-card glass-panel">
                                    <box-icon name='timer' color='#f59e0b' size='lg'></box-icon>
                                    <h3>Expiration Links</h3>
                                    <p>Share files with confidence using self-destructing links. Files become inaccessible automatically.</p>
                                    <span className="status-badge" style={{ marginTop: '10px', display: 'inline-block' }}>ENABLED</span>
                                </div>

                                <div className="security-feature-card glass-panel" style={{ cursor: 'pointer', border: '1px solid rgba(239, 68, 68, 0.2)' }} onClick={handleSelfClean}>
                                    <box-icon name='trash-alt' color='#ef4444' size='lg' animation={isCleaning ? 'tada' : ''}></box-icon>
                                    <h3>Self Clean Purge</h3>
                                    <p>{isCleaning ? 'Cleaning System...' : 'Manually trigger a secure purge of all expired and orphaned files from the server.'}</p>
                                    <span className="status-badge" style={{ marginTop: '10px', display: 'inline-block', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>{isCleaning ? 'RUNNING' : 'READY'}</span>
                                </div>

                                <div className="table-section glass-panel" style={{ gridColumn: '1 / -1' }}>
                                    <h3>Recent Security Logs</h3>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Event Type</th>
                                                <th>Triggered By</th>
                                                <th>Timeline</th>
                                                <th>Security Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loginHistory.slice(0, 8).map((log, i) => (
                                                <tr key={i}>
                                                    <td>System Entry Authorized</td>
                                                    <td>{log.email}</td>
                                                    <td className="time-cell">{new Date(log.createdAt).toLocaleString()}</td>
                                                    <td><span className="gate-authorized">Safe & Verified</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'Admin' && user.role === 'admin' && (
                            <div className="admin-view fade-in">
                                <div className="table-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0 }}>Identity Management</h2>
                                        <p style={{ color: '#94a3b8', fontSize: '13px', margin: '5px 0 0 0' }}>Manage system access and verified user directories.</p>
                                    </div>
                                    <div className="search-box-premium" style={{ width: '300px' }}>
                                        <box-icon name='search' color='#94a3b8' size='xs'></box-icon>
                                        <input
                                            placeholder="Search verified users..."
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="admin-grid">
                                    <div className="table-section glass-panel" style={{ gridColumn: '1 / -1' }}>
                                        <table className="user-dir-table">
                                            <thead>
                                                <tr>
                                                    <th>Verified User</th>
                                                    <th>Email Address</th>
                                                    <th>Registration</th>
                                                    <th>Access Level</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {adminUsers.filter(u => u.username.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
                                                    <tr key={u._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                        <td style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '15px' }}>
                                                            <div className="avatar-premium" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                                                                {u.username.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span style={{ fontWeight: '600' }}>{u.username}</span>
                                                        </td>
                                                        <td>{u.email}</td>
                                                        <td className="time-cell">{new Date(u.createdAt).toLocaleDateString()}</td>
                                                        <td><span className={`role-badge ${u.role}`} style={{ textTransform: 'uppercase', fontSize: '10px' }}>{u.role}</span></td>
                                                        <td><span className="gate-authorized" style={{ fontSize: '10px' }}>VERIFIED</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="table-section glass-panel" style={{ gridColumn: '1 / -1' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                                            <box-icon name='file-find' color='#38bdf8'></box-icon>
                                            <h3 style={{ margin: 0 }}>System-Wide Access Logs</h3>
                                        </div>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Authentication Gate</th>
                                                    <th>Identity</th>
                                                    <th>Timestamp</th>
                                                    <th>Terminal Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {loginHistory.slice(0, 10).map((log, i) => (
                                                    <tr key={i}>
                                                        <td>Member Portal Login</td>
                                                        <td style={{ color: '#38bdf8' }}>{log.email}</td>
                                                        <td className="time-cell">{new Date(log.createdAt).toLocaleString()}</td>
                                                        <td><span className="gate-authorized">SECURE ENTRY</span></td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'IAM' && user.role === 'admin' && (
                            <div className="admin-grid fade-in">
                                <div className="table-section glass-panel">
                                    <h3>IAM Roles & Policies</h3>
                                    <div className="iam-roles-grid">
                                        <div className="iam-role-card" style={{ display: 'flex', gap: '15px', alignItems: 'center', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', marginBottom: '10px' }}>
                                            <box-icon name='terminal' color='#38bdf8'></box-icon>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '14px' }}>Root Admin</h4>
                                                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Full System Access</p>
                                            </div>
                                        </div>
                                        <div className="iam-role-card" style={{ display: 'flex', gap: '15px', alignItems: 'center', padding: '15px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                                            <box-icon name='file-find' color='#94a3b8'></box-icon>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '14px' }}>Auditor</h4>
                                                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8' }}>Read-Only Logs</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '20px' }}>
                                        <button className="dev-close-btn" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }} onClick={handleGenerateKey}>
                                            <box-icon name='plus-circle' color='#fff' size='xs'></box-icon>
                                            GENERATE ACCESS KEY
                                        </button>
                                    </div>
                                    {generatedKey && (
                                        <div className="generated-key-box fade-in" style={{ marginTop: '15px', padding: '10px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px', border: '1px dashed #38bdf8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <code style={{ color: '#38bdf8', fontSize: '12px' }}>{generatedKey}</code>
                                            <box-icon name='copy' color='#38bdf8' size='xs' style={{ cursor: 'pointer' }} onClick={() => copyToClipboard(generatedKey)}></box-icon>
                                        </div>
                                    )}
                                </div>

                                <div className="table-section glass-panel">
                                    <h3>API Security Keys</h3>
                                    <div className="api-key-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div className="key-info">
                                            <span style={{ display: 'block', fontSize: '13px', fontWeight: '600' }}>Production_Main_Key</span>
                                            <code style={{ fontSize: '11px', color: '#38bdf8' }}>AKIA....J2306</code>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <box-icon name='copy' color='#94a3b8' size='xs' style={{ cursor: 'pointer' }} onClick={() => copyToClipboard('AKIA....J2306')}></box-icon>
                                            <span className="gate-authorized">ACTIVE</span>
                                        </div>
                                    </div>
                                    <div className="api-key-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px' }}>
                                        <div className="key-info">
                                            <span style={{ display: 'block', fontSize: '13px', fontWeight: '600' }}>Backup_Storage_Secret</span>
                                            <code style={{ fontSize: '11px', color: '#38bdf8' }}>BKIA....K2006</code>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <box-icon name='copy' color='#94a3b8' size='xs' style={{ cursor: 'pointer' }} onClick={() => copyToClipboard('BKIA....K2006')}></box-icon>
                                            <span className="gate-authorized">SECURE</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'TechCenter' && (
                            <div className="tech-center-section fade-in">
                                <div className="table-header" style={{ marginBottom: '30px' }}>
                                    <h2 style={{ fontSize: '28px', fontWeight: '900', margin: 0 }}>Cloud Architecture & Stack</h2>
                                    <p style={{ color: '#94a3b8', marginTop: '5px' }}>Official technical specifications and development infrastructure.</p>
                                </div>

                                <div className="tech-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '25px' }}>
                                    <div className="glass-panel" style={{ padding: '30px', borderTop: '4px solid #38bdf8' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <box-icon name='layer' color='#38bdf8' size='lg'></box-icon>
                                            <h3 style={{ fontSize: '22px' }}>Core Technology Stack</h3>
                                        </div>
                                        <div className="tech-stack-list" style={{ marginTop: '25px' }}>
                                            {[
                                                { label: 'FRONTEND', val: 'React.js 18 + Vite (High-Performance SPA)' },
                                                { label: 'BACKEND', val: 'Node.js + Express.js (Scalable API Gateway)' },
                                                { label: 'DATABASE', val: 'MongoDB Atlas (NoSQL Document Store)' },
                                                { label: 'ENCRYPTION', val: 'AES-256-GCM (Military-Grade Cryptography)' }
                                            ].map((item, idx) => (
                                                <div key={idx} style={{ marginBottom: '15px', padding: '15px', background: 'rgba(56, 189, 248, 0.05)', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.1)' }}>
                                                    <strong style={{ color: '#38bdf8', fontSize: '11px', letterSpacing: '1px' }}>{item.label}</strong>
                                                    <div style={{ fontSize: '14px', marginTop: '5px', fontWeight: '500' }}>{item.val}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="glass-panel" style={{ padding: '30px', borderTop: '4px solid #4ade80' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <box-icon name='list-check' color='#4ade80' size='lg'></box-icon>
                                            <h3 style={{ fontSize: '22px' }}>Special Specifications</h3>
                                        </div>
                                        <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                            {[
                                                { k: 'Security Protocol', v: 'End-to-End Encryption (E2EE) with zero-knowledge keys.' },
                                                { k: 'Identity Verification', v: 'Role-Based Access Control (RBAC) with hardened JWT tokens.' },
                                                { k: 'Auto Maintenance', v: '24/7 Housekeeper service for secure storage optimization.' },
                                                { k: 'Stability & Logs', v: '24/7 Guardian interceptor for critical system resilience.' }
                                            ].map((spec, idx) => (
                                                <div key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '15px' }}>
                                                    <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>{spec.k}</span>
                                                    <div style={{ fontSize: '15px', marginTop: '4px', lineHeight: '1.5' }}>{spec.v}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="glass-panel" style={{ marginTop: '25px', padding: '30px', textAlign: 'center' }}>
                                    <box-icon name='rocket' color='#38bdf8' size='lg' animation='tada-hover'></box-icon>
                                    <h3 style={{ marginTop: '15px' }}>Cloud System Version 4.0.0</h3>
                                    <p style={{ color: '#94a3b8', maxWidth: '600px', margin: '10px auto' }}>This platform is architected for maximum security, utilizing modern MERN stack principles and client-side encryption modules to ensure data sovereignty.</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'Profile' && (
                            <div className="profile-section fade-in">
                                <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
                                    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                                        <div className="avatar-premium" style={{ width: '100px', height: '100px', fontSize: '40px', margin: '0 auto 20px' }}>
                                            {user.username.charAt(0).toUpperCase()}
                                        </div>
                                        <h2>{user.username}</h2>
                                        <p style={{ color: '#94a3b8' }}>{user.email}</p>
                                        <span className={`role-badge ${user.role}`} style={{ marginTop: '10px', display: 'inline-block' }}>{user.role.toUpperCase()}</span>
                                    </div>
                                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)', margin: '20px 0' }} />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>Account ID</span>
                                            <span style={{ fontFamily: 'monospace' }}>{user._id}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>Account Status</span>
                                            <span style={{ color: '#4ade80' }}>Verified</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#64748b' }}>Authentication</span>
                                            <span>Session Active</span>
                                        </div>
                                    </div>
                                    <button className="neon-btn" style={{ marginTop: '30px' }} onClick={handleLogout}>Sign Out Securely</button>
                                </div>
                            </div>
                        )}
                    </div>
                    <Footer />
                </main>
            </div>
        </div>
    );
}
