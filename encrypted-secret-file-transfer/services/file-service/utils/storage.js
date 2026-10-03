// Protected server-side storage for ENCRYPTED blobs. This directory is never served by any web route.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const NAME_RE = /^[a-f0-9]{32}\.enc$/; // only server-generated random names are ever accepted

function storageDir() {
  return path.resolve(ROOT, process.env.FILE_STORAGE_DIR || './uploads/encrypted');
}

function ensureStorage() {
  const dir = storageDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

// Path-traversal protection: validate the name AND confirm the resolved path stays inside the directory.
function resolveStoredPath(storedName) {
  if (typeof storedName !== 'string' || !NAME_RE.test(storedName)) throw new Error('Invalid storage name');
  const dir = storageDir();
  const full = path.resolve(dir, storedName);
  if (!full.startsWith(dir + path.sep)) throw new Error('Invalid storage path');
  return full;
}

// Write to a temp file, then rename - so a crash never leaves a half-written .enc file.
async function writeEncrypted(storedName, buffer) {
  ensureStorage();
  const full = resolveStoredPath(storedName);
  const tmp = `${full}.tmp`;
  await fs.promises.writeFile(tmp, buffer, { mode: 0o600 });
  await fs.promises.rename(tmp, full);
}

const readEncrypted = (storedName) => fs.promises.readFile(resolveStoredPath(storedName));

async function removeEncrypted(storedName) {
  try { await fs.promises.unlink(resolveStoredPath(storedName)); } catch (_) { /* already gone */ }
}

module.exports = { storageDir, ensureStorage, resolveStoredPath, writeEncrypted, readEncrypted, removeEncrypted };
