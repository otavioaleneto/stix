const crypto = require('crypto');
const { UserProfile } = require('../models');

const TOKEN_SECRET = process.env.PROFILE_TOKEN_SECRET || process.env.SESSION_SECRET || 'godsend-profile-token-secret';

function generateToken(userProfileId, wpUserId) {
  const payload = `${userProfileId}:${wpUserId}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${hmac}`).toString('base64');
  return token;
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length < 4) return null;
    const userProfileId = parseInt(parts[0]);
    const wpUserId = parseInt(parts[1]);
    const timestamp = parseInt(parts[2]);
    const receivedHmac = parts[3];
    const payload = `${userProfileId}:${wpUserId}:${timestamp}`;
    const expectedHmac = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
    if (receivedHmac !== expectedHmac) return null;
    const maxAge = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp > maxAge) return null;
    return { userProfileId, wpUserId };
  } catch (e) {
    return null;
  }
}

async function profileAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.query.profile_token;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }

  try {
    const profile = await UserProfile.findByPk(decoded.userProfileId);
    if (!profile) {
      return res.status(401).json({ success: false, error: 'Profile not found' });
    }
    req.userProfile = profile;
    req.userProfileId = profile.id;
    next();
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Auth error' });
  }
}

async function profileAuthOptional(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.query.profile_token;

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      try {
        const profile = await UserProfile.findByPk(decoded.userProfileId);
        if (profile) {
          req.userProfile = profile;
          req.userProfileId = profile.id;
        }
      } catch (e) {}
    }
  }
  next();
}

module.exports = { profileAuth, profileAuthOptional, generateToken, verifyToken };
