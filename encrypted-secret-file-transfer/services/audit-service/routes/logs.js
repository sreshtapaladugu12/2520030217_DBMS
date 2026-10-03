const router = require('express').Router();
const mongoose = require('mongoose');
const TransferLog = require('../models/TransferLog');
const { authenticate, requireRole, internalOnly } = require('../../../shared/auth');
const { asyncHandler, HttpError } = require('../../../shared/http');
const { isObjectId } = require('../../../shared/validation');
const { ACTIONS } = require('../../../shared/constants');

const oid = (v) => (v && isObjectId(String(v)) ? new mongoose.Types.ObjectId(String(v)) : undefined);

function buildQuery(req, base) {
  const q = { ...base };
  if (req.query.action && ACTIONS.includes(req.query.action)) q.action = req.query.action;
  if (req.query.fileId && isObjectId(req.query.fileId)) q.fileId = oid(req.query.fileId);
  return q;
}

async function page(req, query) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
  const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
  const [logs, total] = await Promise.all([
    TransferLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit),
    TransferLog.countDocuments(query)
  ]);
  return { logs, total, limit, skip };
}

// ---- internal: other services write events here ----
router.post('/internal/logs', internalOnly, asyncHandler(async (req, res) => {
  const b = req.body || {};
  if (!ACTIONS.includes(b.action)) throw new HttpError(400, 'Unknown action');
  const doc = await TransferLog.create({
    userId: oid(b.userId), userName: b.userName, userEmail: b.userEmail,
    fileId: oid(b.fileId), fileName: b.fileName, ownerId: oid(b.ownerId),
    action: b.action, targetUserId: oid(b.targetUserId), targetEmail: b.targetEmail,
    status: ['success', 'denied', 'failed'].includes(b.status) ? b.status : 'success',
    metadata: b.metadata
  });
  res.status(201).json({ id: doc.id });
}));

router.get('/internal/stats', internalOnly, asyncHandler(async (req, res) => {
  const grouped = await TransferLog.aggregate([{ $match: { status: 'success' } }, { $group: { _id: '$action', n: { $sum: 1 } } }]);
  res.json({
    totalEvents: await TransferLog.countDocuments(),
    byAction: Object.fromEntries(grouped.map((g) => [g._id, g.n]))
  });
}));

// A user sees events they performed, events on files they own, or events that target them.
router.get('/logs', authenticate, asyncHandler(async (req, res) => {
  const me = oid(req.user.id);
  res.json(await page(req, buildQuery(req, { $or: [{ userId: me }, { ownerId: me }, { targetUserId: me }] })));
}));

// Admin: system-wide activity.
router.get('/admin/logs', authenticate, requireRole('admin'), asyncHandler(async (req, res) => {
  res.json(await page(req, buildQuery(req, {})));
}));

module.exports = router;
