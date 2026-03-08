import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SYSTEM OWNER & ONLY AUTHORIZED ADMIN
const SYSTEM_OWNER_EMAIL = 'varunkumarj23062006@gmail.com';

// Configure Email Transporter (Directly using user settings or demo fallback)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'cloud.secure.alerts@gmail.com', // Placeholder or user email
        pass: process.env.EMAIL_PASS || 'your_app_password_here'         // App Password
    }
});

/**
 * 24/7 SECURITY MONITOR: Dispatches Instant Alerts to Varun
 * @param {string} type - 'CRITICAL', 'UNAUTHORIZED', 'SYSTEM_AUDIT'
 * @param {object} details - Metadata about the event
 */
export const sendSecurityAlert = async (type, details) => {
    const logMessage = `[${new Date().toLocaleString()}] [${type}] ${JSON.stringify(details)}\n`;

    // 1. Log to local filesystem for auditing
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    fs.appendFileSync(path.join(logDir, 'security_alerts.log'), logMessage);

    console.warn(`[24/7 SECURITY MONITOR] Triggered ${type} Alert!`);

    // 2. Dispatch Email to Varun
    const mailOptions = {
        from: '"Cloud Secure Shield" <cloud.secure.alerts@gmail.com>',
        to: SYSTEM_OWNER_EMAIL,
        subject: `⚠️ SECURITY ALERT: ${type} Activity Detected`,
        html: `
            <div style="font-family: sans-serif; background: #0f172a; color: #fff; padding: 30px; border-radius: 12px; border: 1px solid #38bdf8;">
                <h1 style="color: #ef4444; border-bottom: 2px solid #ef4444; padding-bottom: 10px;">Security Incident Detected</h1>
                <p style="font-size: 16px;">Hello Varun, an automated security scan has detected an <strong>${type}</strong> event on your cloud platform.</p>
                <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; font-family: monospace;">
                    <p><strong>Timeline:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>Identity Involved:</strong> ${details.email || 'Anonymous/Unknown'}</p>
                    <p><strong>Source/Gate:</strong> ${details.source || 'API Gateway'}</p>
                    <p><strong>Details:</strong> ${details.message || 'Suspicious activity pattern detected.'}</p>
                </div>
                <p style="margin-top: 20px; color: #94a3b8; font-size: 12px;">This is an automated 24/7 guardian alert for Varun Kumar J.</p>
            </div>
        `
    };

    try {
        // In a real environment, we would await transporter.sendMail(mailOptions);
        // For this demo, we log the intent to the console to avoid SMTP errors if not configured.
        console.log(`[MAIL DISPATCH] Sending security report to ${SYSTEM_OWNER_EMAIL}...`);
        if (process.env.NODE_ENV === 'production' || process.env.EMAIL_PASS) {
            await transporter.sendMail(mailOptions);
        }
    } catch (err) {
        console.error('[MAIL ERROR] Failed to dispatch security alert to owner.', err.message);
    }
};
