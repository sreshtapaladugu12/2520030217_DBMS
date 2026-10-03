
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const isEmail = (v) => typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v.trim());
const isObjectId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);

// Password policy: >= 8 chars, at least one letter and one digit.
function passwordProblem(p) {
  if (typeof p !== 'string' || p.length < 8) return 'Password must be at least 8 characters';
  if (p.length > 128) return 'Password is too long';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Password must contain letters and digits';
  return null;
}

// Strip control chars and characters unsafe in filenames.
function safeFileName(name) {
  const base = String(name || 'file').split(/[\\/]/).pop();
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_').replace(/^\.+/, '').trim();
  return (cleaned || 'file').slice(0, 150);
}

module.exports = { isEmail, isObjectId, passwordProblem, safeFileName };
