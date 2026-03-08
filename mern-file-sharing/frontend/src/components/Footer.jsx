import './Footer.css';

export default function Footer() {
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    return (
        <footer className="aws-style-footer">
            <div className="aws-footer-content">
                <div className="aws-footer-column">
                    <h4>Learn</h4>
                    <a href="#">What Is Secure Cloud?</a>
                    <a href="#">What Is Cloud Storage?</a>
                    <a href="#">What Is IAM Access?</a>
                    <a href="#">Secure File Sharing Hub</a>
                    <a href="#">Cloud Data Security</a>
                    <a href="#">What's New</a>
                    <a href="#">Blogs</a>
                    <a href="#">Press Releases</a>
                </div>

                <div className="aws-footer-column">
                    <h4>Resources</h4>
                    <a href="#">Getting Started</a>
                    <a href="#">Training</a>
                    <a href="#">Cloud Trust Center</a>
                    <a href="#">Storage Solutions Library</a>
                    <a href="#">Architecture Center</a>
                    <a href="#">Product and Technical FAQs</a>
                    <a href="#">Analyst Reports</a>
                    <a href="#">Integration Partners</a>
                </div>

                <div className="aws-footer-column">
                    <h4>Developers</h4>
                    <a href="#">Builder Center</a>
                    <a href="#">SDKs & Tools</a>
                    <a href="#">Cloud API Reference</a>
                    <a href="#">React UI Components</a>
                    <a href="#">Node.js on Secure Cloud</a>
                    <a href="#">Python on Secure Cloud</a>
                    <a href="#">Enterprise GitHub</a>
                </div>

                <div className="aws-footer-column">
                    <h4>Help</h4>
                    <a href="#">Contact Us</a>
                    <a href="#">File a Support Ticket</a>
                    <a href="#">Cloud re:Post</a>
                    <a href="#">Knowledge Center</a>
                    <a href="#">Platform Support Overview</a>
                    <a href="#">Get Expert Help</a>
                    <a href="#">Dashboard Accessibility</a>
                    <a href="#">Legal</a>
                </div>
            </div>

            <div className="aws-footer-back-to-top" onClick={scrollToTop}>
                Back to top <span style={{ marginLeft: '5px' }}>↑</span>
            </div>

            <div className="aws-footer-bottom">
                <div className="bottom-content">
                    <p>© 2026 SecureCloud System | Built by <span className="dev-name">VARUN KUMAR J</span></p>
                    <div className="social-links">
                        <box-icon type='logo' name='linkedin-square' color='#94a3b8' size='22px'></box-icon>
                        <box-icon type='logo' name='github' color='#94a3b8' size='22px'></box-icon>
                        <box-icon name='envelope' type='solid' color='#94a3b8' size='22px'></box-icon>
                    </div>
                </div>
            </div>
        </footer>
    );
}
