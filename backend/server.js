require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');

const { connectDB } = require('./src/config/db');
const documentRoutes = require('./src/routes/documentRoutes');
const compileRoutes  = require('./src/routes/compileRoutes');
const { warmUp: tectonicWarmUp } = compileRoutes;
const templateRoutes = require('./src/routes/templateRoutes');
const visionRoutes   = require('./src/routes/visionRoutes');
const authRoutes     = require('./src/routes/authRoutes');
const projectRoutes  = require('./src/routes/projectRoutes');
const imageRoutes    = require('./src/routes/imageRoutes');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'https://docformatter.netlify.app',
    ];

    const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
    const isNetlify   = origin.endsWith('.netlify.app');
    // Expo Go on Android sends no Origin header (handled above by !origin check).
    // Built APK requests also arrive without an Origin — allowed by default.

    if (allowedOrigins.includes(origin) || isLocalhost || isNetlify) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
}));
// Reduced from 50mb now that base64 images are stored in Cloudinary, not embedded in project JSON
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.post('/api/debug', (req, res) => {
  fs.appendFileSync('clipboard_debug.txt', '--- DEBUG CLIPBOARD HTML ---\n' + req.body.html + '\n----------------------------\n');
  res.sendStatus(200);
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'AcaDoc Backend', timestamp: new Date().toISOString() });
});

app.use('/api/auth',      authRoutes);
app.use('/api/projects',  projectRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/compile',   compileRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/vision',    visionRoutes);
app.use('/api/images',    imageRoutes);

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

/**
 * Self-ping keep-alive for Render free tier.
 *
 * Render spins down free services after 15 minutes of inactivity.
 * A cold start means Node restarts AND Tectonic re-initialises —
 * adding 30-40 seconds to the first compile after idle.
 *
 * This pings our own /api/health every 14 minutes to keep the dyno
 * awake. It only runs when RENDER_EXTERNAL_URL is set (i.e. on Render),
 * so local dev is unaffected.
 */
function startKeepAlive() {
  const url = process.env.RENDER_EXTERNAL_URL;
  if (!url) return; // not on Render — skip

  const INTERVAL_MS = 14 * 60 * 1000; // 14 minutes (Render timeout is 15)

  setInterval(async () => {
    try {
      const res = await fetch(`${url}/api/health`);
      console.log(`[KeepAlive] Pinged ${url}/api/health → ${res.status}`);
    } catch (err) {
      console.warn(`[KeepAlive] Ping failed: ${err.message}`);
    }
  }, INTERVAL_MS);

  console.log(`[KeepAlive] Active — pinging every 14 min to prevent Render spin-down.`);
}

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

  // Pre-warm Tectonic after the server is listening so startup isn't blocked.
  // This compiles a tiny document to initialise the format cache and package
  // loading, so the first real user compile is fast instead of cold-start slow.
  tectonicWarmUp();

  // Keep the Render free-tier dyno alive (no-op in local dev).
  startKeepAlive();
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
