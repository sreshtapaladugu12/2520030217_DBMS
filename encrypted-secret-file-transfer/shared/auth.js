// JWT helpers and Express middleware shared by all services.
// Every service verifies the JWT itself (defence in depth) - it never trusts the gateway blindly.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { HttpError } = require('./http');

const ISSUER = 'efts-auth-service';

function signToken(user) {
  return jwt.sign(
    { sub: String(user._id || user.id), email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h', issuer: ISSUER }
  );
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { issuer: ISSUER });
}

function extractBearer(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function authenticate(req, res, next) {
  const token = extractBearer(req);
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    const p = verifyToken(token);
    req.user = { id: p.sub, email: p.email, name: p.name, role: p.role };
    next();
  } catch (e) {
    next(new HttpError(401, e.name === 'TokenExpiredError' ? 'Token expired, please log in again' : 'Invalid token'));
  }
}

const requireRole = (role) => (req, res, next) =>
  req.user && req.user.role === role ? next() : next(new HttpError(403, 'Administrator access required'));

// Guards /internal routes: only other services holding INTERNAL_API_KEY may call them.
function internalOnly(req, res, next) {
  const given = Buffer.from(String(req.headers['x-internal-key'] || ''));
  const expected = Buffer.from(String(process.env.INTERNAL_API_KEY || ''));
  if (given.length === expected.length && given.length > 0 && crypto.timingSafeEqual(given, expected)) return next();
  next(new HttpError(403, 'Forbidden'));
}

module.exports = { signToken, verifyToken, extractBearer, authenticate, requireRole, internalOnly };
