require('dotenv').config();

const express = require('express');
const cors = require('cors');

const documentRoutes = require('./src/routes/documentRoutes');
const compileRoutes  = require('./src/routes/compileRoutes');
const templateRoutes = require('./src/routes/templateRoutes');
const visionRoutes   = require('./src/routes/visionRoutes');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or standard server-to-server calls)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://docformatter.netlify.app'
    ];

    const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
    const isNetlify = origin.endsWith('.netlify.app');

    if (allowedOrigins.includes(origin) || isLocalhost || isNetlify) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
}));
app.use(express.json({ limit: '50mb' }));

const fs = require('fs');

// Debug endpoint for clipboard HTML
app.post('/api/debug', (req, res) => {
  fs.appendFileSync('clipboard_debug.txt', '--- DEBUG CLIPBOARD HTML ---\n' + req.body.html + '\n----------------------------\n');
  res.sendStatus(200);
});
app.use(express.urlencoded({ extended: true }));

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'AcaDoc Backend', timestamp: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/documents', documentRoutes); // legacy parse/export (kept for compatibility)
app.use('/api/compile',   compileRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/vision',    visionRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[UnhandledError]', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  AcaDoc Backend → http://localhost:${PORT}`);
  console.log(`   Health    : GET  http://localhost:${PORT}/api/health`);
  console.log(`   Compile   : POST http://localhost:${PORT}/api/compile`);
  console.log(`   Templates : GET  http://localhost:${PORT}/api/templates\n`);
});
