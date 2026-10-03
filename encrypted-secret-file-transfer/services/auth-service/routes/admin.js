const router = require('express').Router();
const User = require('../models/User');
const { authenticate, requireRole } = require('../../../shared/auth');
const { asyncHandler, HttpError } = require('../../../shared/http');
const { isObjectId } = require('../../../shared/validation');
const { logEvent } = require('../../../shared/audit-client');

router.use(authenticate, requireRole('admin'));

router.get('/users', asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(500);
  res.json({ users });
}));

// Enable/disable an account or change role. Admins cannot modify their own account.
router.patch('/users/:id', asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) throw new HttpError(400, 'Invalid user id');
  if (req.params.id === req.user.id) throw new HttpError(400, 'You cannot modify your own account');
  const update = {};
  if (typeof req.body.active === 'boolean') update.active = req.body.active;
  if (['user', 'admin'].includes(req.body.role)) update.role = req.body.role;
  if (!Object.keys(update).length) throw new HttpError(400, 'Nothing to update');
  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!user) throw new HttpError(404, 'User not found');
  await logEvent({
    userId: req.user.id, userName: req.user.name, userEmail: req.user.email, action: 'ADMIN_ACTION',
    targetUserId: user.id, targetEmail: user.email, status: 'success', metadata: update
  });
  res.json({ user });
}));

module.exports = router;
