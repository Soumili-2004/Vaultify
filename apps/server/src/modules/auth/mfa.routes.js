const express = require('express');
const { asyncHandler } = require('@vaultify/utils');
const { authMiddleware } = require('../../middleware/auth.middleware');
const mfaService = require('./mfa.service');
const { User } = require('@vaultify/db');

const router = express.Router();

router.post('/setup', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
  }

  const secret = mfaService.generateSecret(user.email);
  const qrCode = await mfaService.generateQRCode(secret.otpauthURL());

  user.mfa.secret = secret.base32;
  await user.save();

  res.json({
    secret: secret.base32,
    qrCode,
    message: 'Scan the QR code with your authenticator app',
  });
}));

router.post('/verify', authMiddleware, asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'VALIDATION', message: 'Token is required' });
  }

  const user = await User.findById(req.user.userId);
  if (!user || !user.mfa.secret) {
    return res.status(400).json({ error: 'INVALID_STATE', message: 'MFA setup not initiated' });
  }

  const isValid = mfaService.verifyToken(token, user.mfa.secret);
  if (!isValid) {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: 'Invalid MFA token' });
  }

  user.mfa.enabled = true;
  await user.save();

  res.json({ message: 'MFA enabled successfully' });
}));

router.post('/disable', authMiddleware, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' });
  }

  user.mfa.enabled = false;
  user.mfa.secret = null;
  await user.save();

  res.json({ message: 'MFA disabled successfully' });
}));

module.exports = router;
