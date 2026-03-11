const axios = require('axios');
const { WordPressConfig, ConsoleDownload } = require('../models');

let wpConfigCache = null;
let wpCacheTime = 0;

async function getWPConfig() {
  if (wpConfigCache && Date.now() - wpCacheTime < 60000) {
    return wpConfigCache;
  }
  try {
    wpConfigCache = await WordPressConfig.findOne({ where: { is_active: true } });
  } catch (e) {
    wpConfigCache = null;
  }
  wpCacheTime = Date.now();
  return wpConfigCache;
}

async function checkConsoleBanned(req) {
  const consoleId = req.query.console_id || req.headers['x-console-id'];
  if (!consoleId) return false;
  try {
    const record = await ConsoleDownload.findOne({ where: { console_id: consoleId } });
    if (record && record.banned) return true;
  } catch (e) {
  }
  return false;
}

async function apiAuth(req, res, next) {
  if (await checkConsoleBanned(req)) {
    return res.status(403).json({ error: 'Console banned', banned: true });
  }

  if (process.env.API_OPEN_ACCESS === 'true') {
    return next();
  }

  const token = req.headers['x-api-key'] || req.query.api_key;

  if (!token) {
    return res.status(401).json({ error: 'API key required' });
  }

  try {
    const wpConfig = await getWPConfig();
    if (!wpConfig) {
      return res.status(503).json({ error: 'WordPress integration not configured' });
    }

    const response = await axios.get(`${wpConfig.site_url}/wp-json/pmpro/v1/has_membership_access`, {
      params: { api_key: token },
      headers: {
        'Authorization': `Basic ${Buffer.from(`${wpConfig.consumer_key}:${wpConfig.consumer_secret}`).toString('base64')}`
      },
      timeout: 10000
    });

    if (response.data && response.data.has_access) {
      req.wpUser = response.data;
      return next();
    }

    return res.status(403).json({ error: 'Active membership required' });
  } catch (error) {
    console.error('[API_AUTH] WordPress verification failed:', error.message);
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }
}

async function apiAuthOptional(req, res, next) {
  next();
}

module.exports = { apiAuth, apiAuthOptional };
