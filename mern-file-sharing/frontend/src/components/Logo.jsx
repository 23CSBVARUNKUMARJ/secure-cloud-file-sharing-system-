export default function Logo() {
    return (
        <div className="cloud-logo" style={{ display: 'flex', alignItems: 'center', width: '100%', height: '100%' }}>
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                style={{ width: '100%', height: '100%', filter: 'drop-shadow(0px 0px 15px rgba(255, 0, 127, 0.7)) drop-shadow(0px 0px 15px rgba(0, 210, 255, 0.5))' }}
            >
                <defs>
                    <linearGradient id="cloudGradDash" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#00d2ff" />
                        <stop offset="100%" stopColor="#ff007f" />
                    </linearGradient>
                </defs>
                <path
                    fill="url(#cloudGradDash)"
                    d="M17.5 19c2.481 0 4.5-2.019 4.5-4.5 0-2.31-1.763-4.225-4.019-4.46a6.002 6.002 0 0 0-11.85-.387A4.49 4.49 0 0 0 2.5 14.5C2.5 16.981 4.519 19 7 19h10.5z"
                />
            </svg>
        </div>
    );
}
