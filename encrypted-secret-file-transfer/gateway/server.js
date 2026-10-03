// API Gateway (port 4000): single entry point for the browser.
//  - verifies JWTs before routing protected requests
//  - proxies /api/* to the right backend service (streams bodies, so uploads/downloads work)
//  - health checks, aggregate dashboard data, admin stats
//  - serves the built React app from frontend/dist
// Uses only Node built-ins for HTTP so it keeps working even if a backend service is down.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadEnv, requireEnv } = require('../shared/env');
loadEnv();
requireEnv(['JWT_SECRET', 'INTERNAL_API_KEY']);
const { verifyToken, extractBearer } = require('../shared/auth');

const PORT = Number(process.env.PORT || process.env.GATEWAY_PORT || 4000);
const DIST = path.join(__dirname, '..', 'frontend', 'dist');
const MAX_BODY = (Number(process.env.MAX_FILE_SIZE_MB || 10) + 1) * 1024 * 1024;

const SERVICES = {
  authentication: process.env.AUTH_SERVICE_URL || 'http://localhost:4101',
  file: process.env.FILE_SERVICE_URL || 'http://localhost:4102',
  permission: process.env.PERMISSION_SERVICE_URL || 'http://localhost:4103',
  audit: process.env.AUDIT_SERVICE_URL || 'http://localhost:4104'
};

// [gateway prefix, service, service prefix]  (longest prefix wins)
const ROUTES = [
  ['/api/auth', 'authentication', '/auth'],
  ['/api/files', 'file', '/files'],
  ['/api/permissions', 'permission', '/permissions'],
  ['/api/logs', 'audit', '/logs'],
  ['/api/admin/users', 'authentication', '/admin/users'],
  ['/api/admin/logs', 'audit', '/admin/logs']
].sort((a, b) => b[0].length - a[0].length);

const PUBLIC_PATHS = new Set(['/api/auth/register', '/api/auth/login', '/api/health', '/api/service-status']);

// ---------- helpers ----------
function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), 'Cache-Control': 'no-store' });
  res.end(data);
}

function authUser(req) {
  const token = extractBearer(req);
  if (!token) return null;
  try { const p = verifyToken(token); return { id: p.sub, email: p.email, name: p.name, role: p.role }; }
  catch (_) { return null; }
}

// GET JSON from a service (used for aggregation). Returns { ok, status, data } and never throws.
async function getJson(service, urlPath, { headers = {}, timeoutMs = 3000, internal = false } = {}) {
  try {
    const h = { ...headers };
    if (internal) h['x-internal-key'] = process.env.INTERNAL_API_KEY;
    const r = await fetch(SERVICES[service] + urlPath, { headers: h, signal: AbortSignal.timeout(timeoutMs) });
    let data = null; try { data = await r.json(); } catch (_) {}
    return { ok: r.ok, status: r.status, data };
  } catch (_) {
    return { ok: false, status: 0, data: null };
  }
}

async function serviceStatus() {
  const entries = await Promise.all(Object.keys(SERVICES).map(async (name) => {
    const t0 = Date.now();
    const r = await getJson(name, '/health', { timeoutMs: 1500 });
    return [name, { status: r.ok ? 'ok' : 'down', database: r.data && r.data.database, latencyMs: Date.now() - t0 }];
  }));
  const details = Object.fromEntries(entries);
  const dbUp = entries.some(([, v]) => v.database === 'connected');
  return {
    gateway: 'ok',
    ...Object.fromEntries(entries.map(([k, v]) => [k, v.status])),
    database: dbUp ? 'connected' : 'unreachable',
    details,
    checkedAt: new Date().toISOString()
  };
}

// ---------- simple in-memory rate limit for login/register ----------
const hits = new Map();
function rateLimited(ip) {
  const limit = Number(process.env.LOGIN_RATE_LIMIT_PER_MIN || 30);
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > limit;
}

// ---------- aggregate endpoints ----------
async function overview(req, res, user) {
  const auth = { authorization: req.headers.authorization };
  const [status, files, logs] = await Promise.all([
    serviceStatus(),
    getJson('file', '/files?scope=all', { headers: auth }),
    getJson('audit', '/logs?limit=200', { headers: auth })
  ]);
  const warnings = [];
  const filesOk = files.ok && files.data && Array.isArray(files.data.files);
  const logsOk = logs.ok && logs.data && Array.isArray(logs.data.logs);
  const fileList = filesOk ? files.data.files : [];
  const logList = logsOk ? logs.data.logs : [];
  if (!filesOk) warnings.push('File service unavailable - file statistics are incomplete.');
  else warnings.push(...(files.data.warnings || []));
  if (!logsOk) warnings.push('Audit service unavailable - activity is incomplete.');

  const owned = fileList.filter((f) => f.access === 'owner');
  const byAction = (a) => logList.filter((l) => l.action === a);
  res.setHeader('Cache-Control', 'no-store');
  sendJson(res, 200, {
    user,
    stats: {
      totalFiles: owned.length,
      sharedByMe: owned.filter((f) => f.sharedWith && f.sharedWith.length).length,
      sharedWithMe: fileList.length - owned.length,
      accessibleFiles: fileList.length,
      myDownloads: byAction('DOWNLOAD').filter((l) => l.userId === user.id && l.status === 'success').length,
      totalBytes: owned.reduce((s, f) => s + f.size, 0)
    },
    recentUploads: owned.slice(0, 5),
    recentDownloads: byAction('DOWNLOAD').slice(0, 5),
    recentSharing: logList.filter((l) => l.action === 'SHARE' || l.action === 'REVOKE').slice(0, 5),
    recentActivity: logList.slice(0, 8),
    security: { encryption: 'AES-256-GCM (protected)', authentication: 'JWT enabled', database: status.database },
    services: status,
    warnings
  });
}

async function adminStats(req, res) {
  const [status, users, files, perms, audit, recent] = await Promise.all([
    serviceStatus(),
    getJson('authentication', '/internal/stats', { internal: true }),
    getJson('file', '/internal/stats', { internal: true }),
    getJson('permission', '/internal/stats', { internal: true }),
    getJson('audit', '/internal/stats', { internal: true }),
    getJson('audit', '/admin/logs?limit=10', { headers: { authorization: req.headers.authorization } })
  ]);
  const d = (r) => (r.ok ? r.data : null);
  const by = (audit.ok && audit.data.byAction) || {};
  sendJson(res, 200, {
    totalUsers: d(users) ? users.data.totalUsers : null,
    totalFiles: d(files) ? files.data.totalFiles : null,
    totalBytes: d(files) ? files.data.totalBytes : null,
    totalUploads: audit.ok ? by.UPLOAD || 0 : null,
    totalDownloads: audit.ok ? by.DOWNLOAD || 0 : null,
    sharedFiles: d(perms) ? perms.data.sharedFiles : null,
    activePermissions: d(perms) ? perms.data.activePermissions : null,
    totalEvents: audit.ok ? audit.data.totalEvents : null,
    byAction: by,
    recentActivity: recent.ok ? recent.data.logs : [],
    services: status,
    unavailable: [['authentication', users], ['file', files], ['permission', perms], ['audit', audit]].filter(([, r]) => !r.ok).map(([n]) => n)
  });
}

// ---------- proxy ----------
const HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authorization', 'te', 'trailer']);

function proxy(req, res, serviceName, targetPath) {
  const target = new URL(SERVICES[serviceName]);
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!HOP.has(k) && k !== 'host' && k !== 'x-internal-key') headers[k] = v; // never let clients spoof internal key
  }
  headers['x-forwarded-for'] = req.socket.remoteAddress;
  const upstream = http.request({
    hostname: target.hostname, port: target.port, path: targetPath, method: req.method, headers, timeout: 60000
  }, (up) => {
    const out = { ...up.headers };
    for (const h of HOP) delete out[h];
    res.writeHead(up.statusCode, out);
    up.pipe(res);
  });
  upstream.on('timeout', () => upstream.destroy(new Error('timeout')));
  upstream.on('error', () => {
    if (!res.headersSent) sendJson(res, 502, { error: `${serviceName} service is unavailable`, service: serviceName });
    else res.destroy();
  });
  req.pipe(upstream);
}

// ---------- static frontend ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.map': 'application/json' };

function serveStatic(req, res, pathname) {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end('<h2 style="font-family:sans-serif">Gateway is running.</h2><p style="font-family:sans-serif">The React app is not built yet. Run <code>npm run build</code> (then reload), or use <code>npm run dev</code> and open <a href="http://localhost:5173">http://localhost:5173</a>.</p>');
  }
  let file = path.resolve(DIST, '.' + path.normalize(decodeURIComponent(pathname)));
  if (!file.startsWith(DIST) || !fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(DIST, 'index.html'); // SPA fallback
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'"
  });
  fs.createReadStream(file).pipe(res);
}

// ---------- main handler ----------
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const url = new URL(req.url, 'http://gateway');
  const p = url.pathname.replace(/\/+$/, '') || '/';

  try {
    if (!p.startsWith('/api')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' });
      return serveStatic(req, res, p);
    }
    if (p === '/api/health') return sendJson(res, 200, { status: 'ok', service: 'gateway', time: new Date().toISOString() });
    if (p === '/api/service-status') return sendJson(res, 200, await serviceStatus());

    if (Number(req.headers['content-length'] || 0) > MAX_BODY) return sendJson(res, 413, { error: 'File too large' });
    if ((p === '/api/auth/login' || p === '/api/auth/register') && rateLimited(req.socket.remoteAddress)) {
      return sendJson(res, 429, { error: 'Too many attempts, try again in a minute' });
    }

    const user = PUBLIC_PATHS.has(p) ? null : authUser(req);
    if (!PUBLIC_PATHS.has(p) && !user) {
      return sendJson(res, 401, { error: extractBearer(req) ? 'Invalid or expired token' : 'Authentication required' });
    }

    if (p === '/api/overview') return await overview(req, res, user);
    if (p === '/api/admin/stats') {
      if (user.role !== 'admin') return sendJson(res, 403, { error: 'Administrator access required' });
      return await adminStats(req, res);
    }
    if (p.startsWith('/api/admin') && user.role !== 'admin') return sendJson(res, 403, { error: 'Administrator access required' });

    const rule = ROUTES.find(([prefix]) => p === prefix || p.startsWith(prefix + '/'));
    if (!rule) return sendJson(res, 404, { error: 'Route not found' });
    return proxy(req, res, rule[1], rule[2] + url.pathname.slice(rule[0].length) + url.search);
  } catch (e) {
    console.error('[gateway] error:', e.message);
    if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`[gateway] listening on http://localhost:${PORT}`));
}
module.exports = { server };
