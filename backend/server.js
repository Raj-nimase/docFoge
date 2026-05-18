require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');

const { connectDB } = require('./src/config/db');
const documentRoutes = require('./src/routes/documentRoutes');
const compileRoutes  = require('./src/routes/compileRoutes');
const templateRoutes = require('./src/routes/templateRoutes');
const visionRoutes   = require('./src/routes/visionRoutes');
const authRoutes     = require('./src/routes/authRoutes');
const projectRoutes  = require('./src/routes/projectRoutes');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, callback) => {
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
app.use(express.urlencoded({ extended: true }));

app.post('/api/debug', (req, res) => {
  fs.appendFileSync('clipboard_debug.txt', '--- DEBUG CLIPBOARD HTML ---\n' + req.body.html + '\n----------------------------\n');
  res.sendStatus(200);
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'AcaDoc Backend', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/compile',   compileRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/vision',    visionRoutes);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  console.error('[UnhandledError]', err);

  if (err.code === 11000) {
    return res.status(409).json({ success: false, error: 'Duplicate entry' });
  }

  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(e => e.message).join(', ');
    return res.status(400).json({ success: false, error: message });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

async function start() {
  if (!process.env.JWT_SECRET) {
    console.warn('\n⚠️  JWT_SECRET is not set. Add it to backend/.env (see .env.example)\n');
  }

  await connectDB();

  app.listen(PORT, () => {
    console.log(`\n🚀  AcaDoc Backend → http://localhost:${PORT}`);
    console.log(`   Health    : GET  http://localhost:${PORT}/api/health`);
    console.log(`   Auth      : POST http://localhost:${PORT}/api/auth/register`);
    console.log(`   Projects  : GET  http://localhost:${PORT}/api/projects`);
    console.log(`   Compile   : POST http://localhost:${PORT}/api/compile\n`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
