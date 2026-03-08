import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import httpProxy from 'http-proxy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5173;
const proxy = httpProxy.createProxyServer({});

// Handle proxy errors
proxy.on('error', (err, req, res) => {
    console.error('Proxy Error:', err);
    if (!res.headersSent) {
        res.status(502).send('Proxy Error');
    }
});

// Use middleware to handle proxying manually to avoid the routing error
app.use((req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/uploads')) {
        proxy.web(req, res, { target: 'http://localhost:5000' });
    } else {
        next();
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Final fallback for SPA
app.use((req, res) => {
    const indexPath = path.resolve(__dirname, 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
        res.setHeader('Content-Type', 'text/html');
        res.send(fs.readFileSync(indexPath));
    } else {
        res.status(404).send('Not Found');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bridge Server Running on port ${PORT}`);
});
