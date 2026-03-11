const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const sequelize = require('../config/database');

router.get('/', requireAuth, async (req, res) => {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

  res.render('about', {
    title: 'Sobre',
    cmsVersion: req.app.locals.CMS_VERSION || '1.0.0',
    nodeVersion: process.version,
    dbDialect: sequelize.getDialect(),
    uptimeStr
  });
});

module.exports = router;
