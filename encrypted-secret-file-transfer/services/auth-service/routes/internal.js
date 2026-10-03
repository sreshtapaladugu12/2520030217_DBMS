// Service-to-service endpoints (require x-internal-key). Never exposed through the gateway.
const router = require('express').Router();
const User = require('../models/User');
const { internalOnly } = require('../../../shared/auth');
const { asyncHandler, HttpError } = require('../../../shared/http');
const { isEmail } = require('../../../shared/validation');

router.use(internalOnly);

router.get('/users/lookup', asyncHandler(async (req, res) => {
  if (!isEmail(req.query.email)) throw new HttpError(400, 'Valid email required');
  const user = await User.findOne({ email: String(req.query.email).trim().toLowerCase(), active: true });
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ id: user.id, name: user.name, email: user.email });
}));

router.get('/stats', asyncHandler(async (req, res) => {
  const [totalUsers, admins, disabled] = await Promise.all([
    User.countDocuments(), User.countDocuments({ role: 'admin' }), User.countDocuments({ active: false })
  ]);
  res.json({ totalUsers, admins, disabled });
}));

module.exports = router;
