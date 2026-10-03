// HTTP helpers: error class, async wrapper, error middleware, service-to-service calls.
class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFound(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

// Central error handler. Never leaks stack traces, paths, or secrets.
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large' });
    return res.status(400).json({ error: 'Invalid file or request' });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body too large' });
  if (err.name === 'CastError' || err.name === 'ValidationError') return res.status(400).json({ error: 'Invalid request' });
  if (err.code === 11000) return res.status(409).json({ error: 'Record already exists' });
  console.error(`[error] ${req.method} ${req.originalUrl}: ${err.message}`);
  return res.status(500).json({ error: 'Internal server error' });
}

// Call another service. Throws HttpError(502) if it cannot be reached.
async function callService(name, url, { method = 'GET', body, headers = {}, internal = false, timeoutMs = 5000 } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['content-type'] = 'application/json';
  if (internal) h['x-internal-key'] = process.env.INTERNAL_API_KEY;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: h,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (e) {
    throw new HttpError(502, `${name} service is unavailable`, { service: name });
  }
  let data = null;
  try { data = await res.json(); } catch (_) { /* empty body */ }
  return { status: res.status, ok: res.ok, data };
}

// Same as callService but converts non-2xx responses into HttpErrors.
async function callServiceOrThrow(name, url, opts) {
  const r = await callService(name, url, opts);
  if (!r.ok) throw new HttpError(r.status === 404 ? 404 : r.status >= 500 ? 502 : r.status, (r.data && r.data.error) || `${name} service error`);
  return r.data;
}

module.exports = { HttpError, asyncHandler, notFound, errorHandler, callService, callServiceOrThrow };
