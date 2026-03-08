import React, { useState } from 'react';
import axios from 'axios';
import './DashboardHero.css';

const DashboardHero = () => {
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleDemoRequest = async () => {
        setLoading(true);
        try {
            const userInfo = JSON.parse(localStorage.getItem('userInfo'));
            const { data } = await axios.post('/api/auth/demo', { email: userInfo.email });
            setMessage(data.message);
        } catch (err) {
            setMessage('Something went wrong. Please try again later.');
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 6000);
        }
    };

    const handleFreeTrial = async () => {
        setLoading(true);
        try {
            const { data } = await axios.post('/api/auth/activate-trial');
            setMessage(data.message);
        } catch (err) {
            setMessage('Trial activation failed. Check connection.');
        } finally {
            setLoading(false);
            setTimeout(() => setMessage(''), 6000);
        }
    };

    return (
        <section className="dashboard-hero">
            <div className="hero-content">
                <h1 className="hero-title">
                    Ready to Transform Your <span className="highlight">Cloud Strategy?</span>
                </h1>
                <p className="hero-description">
                    Gain full visibility, enforce compliance, and secure every workflow with trusted file sharing and policy-driven automation.
                </p>
                <div className="hero-actions">
                    <button className="btn-primary-hero" onClick={handleDemoRequest} disabled={loading}>
                        {loading ? 'Sending...' : 'Request a Demo'}
                    </button>
                    <button className="btn-secondary-hero" onClick={handleFreeTrial} disabled={loading}>
                        {loading ? 'Processing...' : 'Free Trial'} <span className="arrow">→</span>
                    </button>
                </div>
                {message && (
                    <div className="hero-toast fade-in">
                        <box-icon name='check-circle' color='#22c55e' size='18px'></box-icon>
                        <span>{message}</span>
                    </div>
                )}
            </div>
            <div className="hero-background-text">
                GET STARTED
            </div>
            <div className="hero-glow-1"></div>
            <div className="hero-glow-2"></div>
        </section>
    );
};

export default DashboardHero;
