// ============================================================
// PulseTriage — Express Backend API Server (server/index.js)
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const authRoutes = require('./routes/auth');
const triageRoutes = require('./routes/triage');
const bedsRoutes = require('./routes/beds');
const inspectorRoutes = require('./routes/inspector');

const app = express();
const PORT = process.env.PORT || 3001;

// Global Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[INCOMING] ${req.method} ${req.originalUrl || req.url}`);
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/events') {
      console.log(`[HTTP] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/beds', bedsRoutes);
app.use('/api/inspector', inspectorRoutes);

// Real-Time Server-Sent Events (SSE) Endpoint
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  db.eventSubscribers.add(res);
  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    db.eventSubscribers.delete(res);
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PulseTriage API',
    embeddedDb: db.isEmbedded(),
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    code: err.code || null
  });
});

// Start server
async function startServer() {
  try {
    await db.initDb();
    const server = app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`PulseTriage API Server listening on port ${PORT}`);
      console.log(`Health Check: http://localhost:${PORT}/api/health`);
      console.log(`Database Mode: ${db.isEmbedded() ? 'Embedded PostgreSQL 16 (PGlite)' : 'External PostgreSQL Cluster'}`);
      console.log(`====================================================`);
    });
    return server;
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
