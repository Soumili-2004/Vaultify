const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { User, Workspace } = require('@vaultify/db');
const { signToken } = require('@vaultify/auth');
const { env } = require('../../config/env');
const { asyncHandler } = require('@vaultify/utils');

function normalizeIp(ip) {
  if (!ip) return '';
  let clean = ip.trim().toLowerCase();
  if (clean.startsWith('::ffff:')) {
    clean = clean.substring(7);
  }
  if (clean === '::1' || clean === 'localhost') {
    return '127.0.0.1';
  }
  return clean;
}

function computeBinding(req) {
  const clientIp = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  const normalizedIp = normalizeIp(clientIp);
  const ua = req.headers['user-agent'] || '';
  return {
    ipHash: crypto.createHash('sha256').update(normalizedIp).digest('hex').slice(0, 16),
    uaHash: crypto.createHash('sha256').update(ua).digest('hex').slice(0, 16),
  };
}


const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Email, password, and name are required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Password must be at least 6 characters' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: 'CONFLICT', message: 'User with this email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await User.create({
    email: email.toLowerCase(),
    password: hashedPassword,
    name,
    role: 'owner',
  });

  const workspace = await Workspace.create({
    name: `${name}'s Workspace`,
    ownerId: user._id,
    members: [
      {
        userId: user._id,
        email: user.email,
        name: user.name,
        role: 'owner',
      },
    ],
  });

  user.workspaceId = workspace._id;
  await user.save();

  const binding = computeBinding(req);
  const payload = { userId: user._id, email: user.email, name: user.name, role: user.role, workspaceId: workspace._id };
  const accessToken = signToken(payload, env.JWT_SECRET, '1h', binding);
  const refreshToken = signToken(payload, env.REFRESH_TOKEN_SECRET, '7d', binding);

  user.refreshToken = refreshToken;
  await user.save();

  res.status(201).json({
    message: 'Account created successfully',
    user: { id: user._id, email: user.email, name: user.name, role: user.role },
    workspace: { id: workspace._id, name: workspace.name },
    accessToken,
    refreshToken,
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ error: 'AUTH_FAILED', message: 'Invalid email or password' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'AUTH_FAILED', message: 'Invalid email or password' });
  }

  const binding = computeBinding(req);
  const payload = { userId: user._id, email: user.email, name: user.name, role: user.role, workspaceId: user.workspaceId };
  const accessToken = signToken(payload, env.JWT_SECRET, '1h', binding);
  const refreshToken = signToken(payload, env.REFRESH_TOKEN_SECRET, '7d', binding);

  user.refreshToken = refreshToken;
  await user.save();

  res.json({
    message: 'Login successful',
    user: { id: user._id, email: user.email, name: user.name, role: user.role },
    accessToken,
    refreshToken,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Refresh token is required' });
  }

  const { verifyToken } = require('@vaultify/auth');
  const { valid, decoded, error } = verifyToken(refreshToken, env.REFRESH_TOKEN_SECRET);

  if (!valid) {
    return res.status(401).json({ error: 'TOKEN_INVALID', message: `Refresh failed: ${error}` });
  }

  const user = await User.findById(decoded.userId);
  if (!user || user.refreshToken !== refreshToken) {
    return res.status(401).json({ error: 'TOKEN_INVALID', message: 'Refresh token is invalid or revoked' });
  }

  const binding = computeBinding(req);
  const payload = { userId: user._id, email: user.email, name: user.name, role: user.role, workspaceId: user.workspaceId };
  const newAccessToken = signToken(payload, env.JWT_SECRET, '1h', binding);
  const newRefreshToken = signToken(payload, env.REFRESH_TOKEN_SECRET, '7d', binding);

  user.refreshToken = newRefreshToken;
  await user.save();

  res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
});

const logout = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (user) {
    user.refreshToken = null;
    await user.save();
  }
  res.json({ message: 'Logged out successfully' });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId).select('-password -refreshToken');
  if (!user) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
  }
  res.json({ user });
});

module.exports = { register, login, refresh, logout, getMe };
