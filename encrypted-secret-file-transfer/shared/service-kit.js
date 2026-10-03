// Boots a backend service: env validation, Express, /health, routes, error handling, MongoDB.
const express = require('express');
const { loadEnv, requireEnv } = require('./env');
const { notFound, errorHandler } = require('./http');
const { connectDb, dbStatus } = require('./db');

async function startService({ name, port, routes }) {
  loadEnv();
  requireEnv(['MONGODB_URI', 'JWT_SECRET', 'FILE_ENCRYPTION_KEY', 'INTERNAL_API_KEY']);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => {
    const db = dbStatus();
    res.status(db === 'connected' ? 200 : 503).json({
      service: name, status: db === 'connected' ? 'ok' : 'degraded', database: db, time: new Date().toISOString()
    });
  });

  routes(app);
  app.use(notFound);
  app.use(errorHandler);

  await connectDb(name);
  // Services bind to localhost by default; Docker sets SERVICE_HOST=0.0.0.0.
  app.listen(port, process.env.SERVICE_HOST || '127.0.0.1', () => console.log(`[${name}] listening on :${port}`));
}

module.exports = { startService };
