import { useState } from 'react';
import './AwsHeader.css';

export default function AwsHeader() {
    const [isSupportOpen, setIsSupportOpen] = useState(false);

    return (
        <header className="aws-header-m">
            {/* Top Bar - Dark Navy */}
            <div className="aws-top-bar">
                <div className="aws-top-nav-list">
                    <div className="aws-nav-item">
                        <box-icon name='globe' color='#ccc' size='14px'></box-icon>
                        <span>English</span>
                        <box-icon name='chevron-down' color='#ccc' size='14px'></box-icon>
                    </div>
                    <div className="aws-nav-item">Contact us</div>
                    <div className="aws-nav-item">AWS Marketplace</div>
                    <div
                        className="aws-nav-item dropdown-trigger"
                        onMouseEnter={() => setIsSupportOpen(true)}
                        onMouseLeave={() => setIsSupportOpen(false)}
                    >
                        <span>Support</span>
                        <box-icon name='chevron-down' color='#ccc' size='14px'></box-icon>

                        {isSupportOpen && (
                            <div className="aws-dropdown-menu">
                                <div className="aws-dropdown-item">Support Center</div>
                                <div className="aws-dropdown-item">Expert Help</div>
                                <div className="aws-dropdown-item">Documentation</div>
                                <div className="aws-dropdown-item">Knowledge Center</div>
                                <div className="aws-dropdown-item">AWS Support Overview</div>
                                <div className="aws-dropdown-item">AWS re:Post</div>
                            </div>
                        )}
                    </div>
                    <div className="aws-nav-item">
                        <span>My account</span>
                        <box-icon name='chevron-down' color='#ccc' size='14px'></box-icon>
                    </div>
                    <div className="aws-nav-item-login">
                        <box-icon name='user' type='regular' color='#fff' size='18px'></box-icon>
                    </div>
                </div>
            </div>

            {/* Middle Bar - White */}
            <div className="aws-middle-bar">
                <div className="aws-mid-left">
                    <div className="aws-logo-m">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/9/93/Amazon_Web_Services_Logo.svg" alt="AWS Logo" style={{ height: '28px' }} />
                    </div>
                    <div className="aws-mid-links">
                        <span>Discover AWS</span>
                        <span>Products</span>
                        <span>Solutions</span>
                        <span>Pricing</span>
                        <span className="active-link">Resources</span>
                    </div>
                </div>
                <div className="aws-mid-right">
                    <div className="aws-search-m">
                        <box-icon name='search' color='#16191f' size='16px'></box-icon>
                        <span className="search-text-m">Search</span>
                    </div>
                    <div className="aws-auth-links">
                        <span className="aws-sign-in">Sign in to console</span>
                        <button className="aws-create-btn">Create account</button>
                    </div>
                </div>
            </div>

            {/* Bottom Bar - Gradient/White */}
            <div className="aws-bottom-bar">
                <div className="aws-bot-inner">
                    <div className="aws-management-title">
                        AWS Management Console
                    </div>
                    <div className="aws-bot-links">
                        <span className="active-bot-link">Overview</span>
                        <span>Features</span>
                        <span>Mobile Application</span>
                        <span>FAQs</span>
                    </div>
                </div>
            </div>
        </header>
    );
}
