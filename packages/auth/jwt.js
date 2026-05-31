const jwt = require('jsonwebtoken');
const { generateJti } = require('./jtiStore');

function signToken(payload, secret, expiresIn = '1h', binding = {}) {
  const jti = generateJti();
  const token = jwt.sign(
    {
      ...payload,
      jti,
      ip_hash: binding.ipHash || null,
      ua_hash: binding.uaHash || null,
    },
    secret,
    { expiresIn }
  );
  return token;
}

function verifyToken(token, secret) {
  try {
    const decoded = jwt.verify(token, secret);
    return { valid: true, decoded, error: null };
  } catch (err) {
    return { valid: false, decoded: null, error: err.message };
  }
}

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

function checkTokenBinding(decoded, req) {
  if (!decoded) return { valid: false, reason: 'No token payload' };

  if (decoded.ip_hash) {
    const clientIp = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    const normalizedIp = normalizeIp(clientIp);
    const ipHash = require('crypto').createHash('sha256').update(normalizedIp).digest('hex').slice(0, 16);
    if (ipHash !== decoded.ip_hash) {
      return { valid: false, reason: 'IP address changed — token binding violated' };
    }
  }

  if (decoded.ua_hash) {
    const ua = req.headers['user-agent'] || '';
    const uaHash = require('crypto').createHash('sha256').update(ua).digest('hex').slice(0, 16);
    if (uaHash !== decoded.ua_hash) {
      return { valid: false, reason: 'User-Agent changed — token binding violated' };
    }
  }

  return { valid: true };
}

module.exports = { signToken, verifyToken, checkTokenBinding, generateJti };
