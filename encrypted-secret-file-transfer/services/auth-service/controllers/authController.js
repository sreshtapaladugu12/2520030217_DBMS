const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { HttpError, asyncHandler } = require('../../../shared/http');
const { signToken } = require('../../../shared/auth');
const { isEmail, passwordProblem } = require('../../../shared/validation');
const { logEvent } = require('../../../shared/audit-client');

const BCRYPT_ROUNDS = 10;
// Compared against when the email does not exist, so response time is similar either way.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-1', BCRYPT_ROUNDS);

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2) throw new HttpError(400, 'Name must be at least 2 characters');
  if (!isEmail(email)) throw new HttpError(400, 'A valid email is required');
  const pwProblem = passwordProblem(password);
  if (pwProblem) throw new HttpError(400, pwProblem);

  const normalized = email.trim().toLowerCase();
  if (await User.exists({ email: normalized })) throw new HttpError(409, 'An account with this email already exists');

  // role is never read from the request body: self-registration always creates a normal user.
  const user = await User.create({
    name: name.trim(), email: normalized, role: 'user',
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS)
  });
  await logEvent({ userId: user.id, userName: user.name, userEmail: user.email, action: 'REGISTER', status: 'success' });
  res.status(201).json({ token: signToken(user), user });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!isEmail(email) || typeof password !== 'string') throw new HttpError(400, 'Email and password are required');

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) {
    await logEvent({ userId: user && user.id, userEmail: email.trim().toLowerCase(), action: 'LOGIN_FAILED', status: 'denied' });
    throw new HttpError(401, 'Invalid email or password'); // same message in both cases
  }
  if (!user.active) throw new HttpError(403, 'This account has been disabled');

  user.lastLoginAt = new Date();
  await user.save();
  await logEvent({ userId: user.id, userName: user.name, userEmail: user.email, action: 'LOGIN', status: 'success' });
  res.json({ token: signToken(user), user });
});

const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user || !user.active) throw new HttpError(401, 'Account not available');
  res.json({ user });
});

module.exports = { register, login, me };
