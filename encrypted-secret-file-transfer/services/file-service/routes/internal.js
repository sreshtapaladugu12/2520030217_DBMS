const router = require('express').Router();
const File = require('../models/File');
const { internalOnly } = require('../../../shared/auth');
const { asyncHandler, HttpError } = require('../../../shared/http');
const { isObjectId } = require('../../../shared/validation');

router.use(internalOnly);

// Used by the permission service to validate ownership before granting/listing shares.
router.get('/files/:id', asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new HttpError(400, 'Invalid file id');
  const f = await File.findById(req.params.id);
  if (!f) throw new HttpError(404, 'File not found');
  res.json({ id: String(f._id), originalName: f.originalName, ownerId: String(f.ownerId) });
}));

router.get('/stats', asyncHandler(async (req, res) => {
  const agg = await File.aggregate([{ $group: { _id: null, files: { $sum: 1 }, bytes: { $sum: '$size' } } }]);
  res.json({ totalFiles: agg[0] ? agg[0].files : 0, totalBytes: agg[0] ? agg[0].bytes : 0 });
}));

module.exports = router;
