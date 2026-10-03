const File = require('../models/File');
const { encryptBuffer, decryptBuffer, sha256, randomStoredName } = require('../utils/crypto');
const storage = require('../utils/storage');
const perm = require('../utils/permissionClient');
const { HttpError, asyncHandler } = require('../../../shared/http');
const { isObjectId, safeFileName } = require('../../../shared/validation');
const { SAFE_DOWNLOAD_MIME } = require('../../../shared/constants');
const { logEvent } = require('../../../shared/audit-client');

const actorOf = (u) => ({ userId: u.id, userName: u.name, userEmail: u.email });
const fileLog = (u, f, action, status = 'success', metadata) => logEvent({
  ...actorOf(u), fileId: String(f._id), fileName: f.originalName, ownerId: String(f.ownerId), action, status, metadata
});

// Returns 'owner' | 'download' | 'view' | null. All authorization happens here, on the server.
async function accessLevel(file, user) {
  if (String(file.ownerId) === user.id) return 'owner';
  return perm.sharedLevel(String(file._id), user.id);
}

async function loadFile(id) {
  if (!isObjectId(id)) throw new HttpError(400, 'Invalid file id');
  const file = await File.findById(id);
  if (!file) throw new HttpError(404, 'File not found');
  return file;
}

// ---------------- UPLOAD ----------------
const upload = asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Invalid file or request: attach a file in the "file" field');
  if (req.file.size === 0) throw new HttpError(400, 'The file is empty');

  // multer decodes names as latin1; restore UTF-8, then sanitise.
  const originalName = safeFileName(Buffer.from(req.file.originalname, 'latin1').toString('utf8'));
  const plaintext = req.file.buffer;
  const storedName = randomStoredName();

  let encrypted;
  try {
    encrypted = encryptBuffer(plaintext);
  } catch (e) {
    console.error('[file-service] encryption failed:', e.message);
    throw new HttpError(500, 'File could not be encrypted');
  }

  await storage.writeEncrypted(storedName, encrypted.ciphertext);
  let doc;
  try {
    doc = await File.create({
      originalName, storedName, ownerId: req.user.id, ownerName: req.user.name, ownerEmail: req.user.email,
      mimeType: req.file.mimetype || 'application/octet-stream',
      size: plaintext.length, encryptedSize: encrypted.ciphertext.length, sha256: sha256(plaintext),
      storagePath: storedName, encryption: encrypted.meta
    });
  } catch (e) {
    await storage.removeEncrypted(storedName); // keep disk and DB consistent
    throw e;
  }
  await fileLog(req.user, doc, 'UPLOAD', 'success', { size: doc.size });
  res.status(201).json({ file: { ...doc.toPublic(), access: 'owner', sharedWith: [] } });
});

// ---------------- LIST ----------------
const list = asyncHandler(async (req, res) => {
  const scope = ['owned', 'shared', 'all'].includes(req.query.scope) ? req.query.scope : 'all';
  const warnings = [];
  const out = [];

  if (scope !== 'shared') {
    const owned = await File.find({ ownerId: req.user.id }).sort({ createdAt: -1 });
    let shares = {};
    try { shares = await perm.sharesForFiles(owned.map((f) => String(f._id))); }
    catch (e) { warnings.push('Permission service unavailable: sharing details are not shown.'); }
    for (const f of owned) out.push({ ...f.toPublic(), access: 'owner', sharedWith: shares[String(f._id)] || [] });
  }

  if (scope !== 'owned') {
    try {
      const shares = await perm.sharedFileIds(req.user.id);
      const levels = new Map(shares.map((s) => [s.fileId, s.level]));
      const files = await File.find({ _id: { $in: [...levels.keys()] } });
      for (const f of files) out.push({ ...f.toPublic(), access: levels.get(String(f._id)), sharedWith: [] });
    } catch (e) {
      warnings.push('Permission service unavailable: files shared with you are not shown.');
    }
  }
  out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ files: out, warnings });
});

// ---------------- DETAILS ----------------
const details = asyncHandler(async (req, res) => {
  const file = await loadFile(req.params.id);
  const level = await accessLevel(file, req.user);
  if (!level) throw new HttpError(403, 'You do not have permission to access this file');
  let sharedWith = [];
  if (level === 'owner') {
    try { sharedWith = (await perm.sharesForFiles([String(file._id)]))[String(file._id)] || []; } catch (e) { /* degrade */ }
  }
  res.json({ file: { ...file.toPublic(), access: level, sharedWith } });
});

// ---------------- DOWNLOAD (authorise -> read -> decrypt -> send) ----------------
const download = asyncHandler(async (req, res) => {
  const file = await loadFile(req.params.id);
  const level = await accessLevel(file, req.user);
  if (level !== 'owner' && level !== 'download') {
    await fileLog(req.user, file, 'DOWNLOAD_DENIED', 'denied');
    throw new HttpError(403, 'You do not have permission to access this file');
  }

  let plaintext;
  try {
    const encrypted = await storage.readEncrypted(file.storedName);
    plaintext = decryptBuffer(encrypted, file.encryption);
    if (sha256(plaintext) !== file.sha256) throw new Error('integrity mismatch');
  } catch (e) {
    console.error(`[file-service] decrypt/read failed for ${file._id}: ${e.message}`);
    await fileLog(req.user, file, 'DOWNLOAD', 'failed');
    throw new HttpError(500, 'File could not be decrypted');
  }

  await fileLog(req.user, file, 'DOWNLOAD', 'success', { via: level });
  const ascii = file.originalName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.set({
    'Content-Type': SAFE_DOWNLOAD_MIME.includes(file.mimeType) ? file.mimeType : 'application/octet-stream',
    'Content-Length': plaintext.length,
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  });
  res.end(plaintext);
});

// ---------------- DELETE (owner only) ----------------
const remove = asyncHandler(async (req, res) => {
  const file = await loadFile(req.params.id);
  if (String(file.ownerId) !== req.user.id) throw new HttpError(403, 'Only the owner can delete this file');
  await storage.removeEncrypted(file.storedName);
  await File.deleteOne({ _id: file._id });
  await perm.revokeAllForFile(String(file._id), actorOf(req.user));
  await fileLog(req.user, file, 'DELETE');
  res.json({ message: 'File deleted' });
});

module.exports = { upload, list, details, download, remove };
