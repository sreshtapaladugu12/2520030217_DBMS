const router = require('express').Router();
const Permission = require('../models/Permission');
const { internalOnly } = require('../../../shared/auth');
const { asyncHandler, HttpError } = require('../../../shared/http');
const { isObjectId } = require('../../../shared/validation');
const { logEvent } = require('../../../shared/audit-client');

router.use(internalOnly);

// Is `userId` allowed to access `fileId`? (owner check happens in the file service)
router.get('/check', asyncHandler(async (req, res) => {
  const { fileId, userId } = req.query;
  if (!isObjectId(String(fileId)) || !isObjectId(String(userId))) throw new HttpError(400, 'Invalid ids');
  const p = await Permission.findOne({ fileId, userId, status: 'active' });
  res.json({ allowed: !!p, level: p ? p.level : null });
}));

// All files shared with a user.
router.get('/shared/:userId', asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.userId)) throw new HttpError(400, 'Invalid id');
  const rows = await Permission.find({ userId: req.params.userId, status: 'active' });
  res.json({ shares: rows.map((p) => ({ fileId: String(p.fileId), level: p.level, ownerId: String(p.ownerId), grantedAt: p.createdAt })) });
}));

// For owners' file lists: who has each file been shared with?
router.get('/file-shares', asyncHandler(async (req, res) => {
  const ids = String(req.query.fileIds || '').split(',').filter(isObjectId).slice(0, 500);
  const rows = await Permission.find({ fileId: { $in: ids }, status: 'active' });
  const shares = {};
  for (const p of rows) {
    (shares[String(p.fileId)] ||= []).push({
      permissionId: String(p.id), userId: String(p.userId), email: p.userEmail, name: p.userName, level: p.level, grantedAt: p.createdAt
    });
  }
  res.json({ shares });
}));

// Called by the file service when a file is deleted.
router.delete('/file/:fileId', asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.fileId)) throw new HttpError(400, 'Invalid id');
  const active = await Permission.find({ fileId: req.params.fileId, status: 'active' });
  await Permission.updateMany({ fileId: req.params.fileId, status: 'active' }, { status: 'revoked', revokedAt: new Date() });
  const actor = req.body || {};
  for (const p of active) {
    await logEvent({ ...actor, fileId: String(p.fileId), fileName: p.fileName, ownerId: String(p.ownerId),
      action: 'REVOKE', targetUserId: String(p.userId), targetEmail: p.userEmail, status: 'success', metadata: { reason: 'file deleted' } });
  }
  res.json({ revoked: active.length });
}));

router.get('/stats', asyncHandler(async (req, res) => {
  const [active, revoked, sharedFiles] = await Promise.all([
    Permission.countDocuments({ status: 'active' }),
    Permission.countDocuments({ status: 'revoked' }),
    Permission.distinct('fileId', { status: 'active' })
  ]);
  res.json({ activePermissions: active, revokedPermissions: revoked, sharedFiles: sharedFiles.length });
}));

module.exports = router;
