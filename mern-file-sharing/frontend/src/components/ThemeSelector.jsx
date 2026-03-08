import { useState, useEffect } from 'react';
import './ThemeSelector.css';

const themes = [
    { id: 'cyber-bunker', name: 'Cyber Bunker', color: '#a3e635', bg: '#050505' },
    { id: 'minimalist', name: 'Minimalist', color: '#0d9488', bg: '#f8fafc' },
    { id: 'royal-blue', name: 'Royal Blue', color: '#3b82f6', bg: '#0f172a' },
    { id: 'tokyo', name: 'Tokyo', color: '#f472b6', bg: '#09090b' }
];

export default function ThemeSelector() {
    const [isOpen, setIsOpen] = useState(false);
    const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('user-theme') || 'royal-blue');

    useEffect(() => {
        document.body.className = `theme-${currentTheme}`;
        localStorage.setItem('user-theme', currentTheme);
    }, [currentTheme]);

    const handleThemeChange = (themeId) => {
        setCurrentTheme(themeId);
        // setIsOpen(false); // Optionally close on select
    };

    return (
        <div className="theme-selector-container">
            <div className="theme-trigger" onClick={() => setIsOpen(!isOpen)}>
                <span className="theme-label">theme</span>
                <div className="theme-icon-wrapper">
                    <div className={`theme-circle ${currentTheme}`}></div>
                </div>
            </div>

            {isOpen && (
                <div className="theme-popup-overlay" onClick={() => setIsOpen(false)}>
                    <div className="theme-popup-card" onClick={(e) => e.stopPropagation()}>
                        <div className="theme-popup-header">
                            <h3>Theme</h3>
                        </div>
                        <div className="theme-options-list">
                            {themes.map((theme) => (
                                <div
                                    key={theme.id}
                                    className={`theme-option ${currentTheme === theme.id ? 'active' : ''}`}
                                    onClick={() => handleThemeChange(theme.id)}
                                >
                                    <div className="theme-preview" style={{ background: theme.bg }}>
                                        <div className="preview-accent" style={{ background: theme.color }}></div>
                                        <div className="preview-box" style={{ borderColor: theme.color }}></div>
                                    </div>
                                    <span className="theme-name">{theme.name}</span>
                                    <div className="theme-radio">
                                        <div className="radio-outer">
                                            {currentTheme === theme.id && <div className="radio-inner"></div>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
