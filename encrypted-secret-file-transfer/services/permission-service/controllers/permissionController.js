const Permission = require('../models/Permission');
const { HttpError, asyncHandler, callService } = require('../../../shared/http');
const { isEmail, isObjectId } = require('../../../shared/validation');
const { PERMISSION_LEVELS } = require('../../../shared/constants');
const { logEvent } = require('../../../shared/audit-client');

// Ask the file service about a file (exists? who owns it?).
async function fetchFile(fileId) {
  const r = await callService('file', `${process.env.FILE_SERVICE_URL}/internal/files/${fileId}`, { internal: true });
  if (r.status === 404) throw new HttpError(404, 'File not found');
  if (!r.ok) throw new HttpError(502, 'file service is unavailable', { service: 'file' });
  return r.data;
}

async function requireOwner(fileId, user) {
  if (!isObjectId(fileId)) throw new HttpError(400, 'Invalid file id');
  const file = await fetchFile(fileId);
  if (file.ownerId !== user.id) throw new HttpError(403, 'Only the file owner can manage permissions');
  return file;
}

const actor = (u) => ({ userId: u.id, userName: u.name, userEmail: u.email });

// POST /permissions  { fileId, email, level? }
const grant = asyncHandler(async (req, res) => {
  const { fileId, email } = req.body || {};
  const level = req.body && req.body.level ? req.body.level : 'download';
  if (!isObjectId(fileId)) throw new HttpError(400, 'A valid fileId is required');
  if (!isEmail(email)) throw new HttpError(400, 'A valid recipient email is required');
  if (!PERMISSION_LEVELS.includes(level)) throw new HttpError(400, 'Invalid permission level');

  const file = await requireOwner(fileId, req.user);

  const lookup = await callService('auth', `${process.env.AUTH_SERVICE_URL}/internal/users/lookup?email=${encodeURIComponent(email.trim())}`, { internal: true });
  if (lookup.status === 404) throw new HttpError(404, 'No registered user with that email');
  if (!lookup.ok) throw new HttpError(502, 'auth service is unavailable', { service: 'auth' });
  const recipient = lookup.data;
  if (recipient.id === req.user.id) throw new HttpError(400, 'You already own this file');

  let perm = await Permission.findOne({ fileId, userId: recipient.id });
  if (perm && perm.status === 'active') throw new HttpError(409, `Already shared with ${recipient.email}`);
  if (perm) {                          // previously revoked: re-activate
    perm.status = 'active'; perm.revokedAt = undefined; perm.level = level; perm.fileName = file.originalName;
    await perm.save();
  } else {
    perm = await Permission.create({
      fileId, fileName: file.originalName, ownerId: req.user.id, userId: recipient.id,
      userEmail: recipient.email, userName: recipient.name, level
    });
  }
  await logEvent({ ...actor(req.user), fileId, fileName: file.originalName, ownerId: req.user.id,
    action: 'SHARE', targetUserId: recipient.id, targetEmail: recipient.email, status: 'success', metadata: { level } });
  res.status(201).json({ permission: perm });
});

// GET /permissions/:fileId  (owner only)
const listForFile = asyncHandler(async (req, res) => {
  await requireOwner(req.params.fileId, req.user);
  const permissions = await Permission.find({ fileId: req.params.fileId, status: 'active' }).sort({ createdAt: -1 });
  res.json({ permissions });
});

// DELETE /permissions/:id  (owner only) -> marks revoked
const revoke = asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new HttpError(400, 'Invalid permission id');
  const perm = await Permission.findById(req.params.id);
  if (!perm || perm.status !== 'active') throw new HttpError(404, 'Permission not found');
  if (String(perm.ownerId) !== req.user.id) throw new HttpError(403, 'Only the file owner can revoke access');
  perm.status = 'revoked'; perm.revokedAt = new Date();
  await perm.save();
  await logEvent({ ...actor(req.user), fileId: String(perm.fileId), fileName: perm.fileName, ownerId: req.user.id,
    action: 'REVOKE', targetUserId: String(perm.userId), targetEmail: perm.userEmail, status: 'success' });
  res.json({ message: 'Access revoked', permission: perm });
});

module.exports = { grant, listForFile, revoke };
