const express = require('express');
const router = express.Router();
const path = require('path');
const archiver = require('archiver');
const fs = require('fs');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/download', (req, res) => {
  const pluginDir = path.join(__dirname, '..', 'public', 'plugin');
  const webuiDir = path.join(__dirname, '..', 'public', 'nova-webui');

  if (!fs.existsSync(pluginDir)) {
    return res.status(404).send('Plugin not found');
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="GODSend_Plugin_v8.0.zip"');

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    console.error('[PLUGIN] Archive error:', err);
    if (!res.headersSent) {
      res.status(500).send('Error creating archive');
    }
  });

  archive.pipe(res);
  archive.directory(pluginDir, 'GODSend');

  if (fs.existsSync(webuiDir)) {
    archive.directory(webuiDir, 'GODSend/webuis/Nova', (entry) => {
      if (entry.name === 'js/cms-config.js') return false;
      return entry;
    });

    const configScript = '// CMS URL is hardcoded in nova-api.js';
    archive.append(configScript, { name: 'GODSend/webuis/Nova/js/cms-config.js' });
  }

  archive.finalize();
});

router.get('/download-wp-plugin', requireAuth, requireRole('super_admin', 'admin'), (req, res) => {
  const wpPluginFile = path.join(__dirname, '..', 'public', 'wp-plugin', 'godsend-api.php');

  if (!fs.existsSync(wpPluginFile)) {
    return res.status(404).send('WordPress plugin not found');
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="godsend-api.zip"');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error('[WP-PLUGIN] Archive error:', err);
    if (!res.headersSent) res.status(500).send('Error creating archive');
  });

  archive.pipe(res);
  archive.file(wpPluginFile, { name: 'godsend-api/godsend-api.php' });
  archive.finalize();
});

router.get('/download-ftp-bridge', (req, res) => {
  const bridgeDir = path.join(__dirname, '..', 'public', 'ftp-bridge');

  if (!fs.existsSync(bridgeDir)) {
    return res.status(404).send('FTP Bridge not found');
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="GODSend_FTP_Bridge.zip"');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error('[FTP-BRIDGE] Archive error:', err);
    if (!res.headersSent) res.status(500).send('Error creating archive');
  });

  archive.pipe(res);

  archive.file(path.join(bridgeDir, 'bridge.js'), { name: 'godsend-ftp-bridge/bridge.js' });
  archive.file(path.join(bridgeDir, 'package.json'), { name: 'godsend-ftp-bridge/package.json' });
  archive.file(path.join(bridgeDir, 'README.md'), { name: 'godsend-ftp-bridge/README.md' });

  const xboxIp = req.query.xbox_ip || '192.168.1.100';
  const bridgeConfig = JSON.stringify({
    httpPort: 7860,
    ftpHost: xboxIp,
    ftpPort: 21,
    ftpUser: 'xboxftp',
    ftpPass: 'xboxftp',
    ftpSecure: false
  }, null, 2);
  archive.append(bridgeConfig, { name: 'godsend-ftp-bridge/bridge-config.json' });

  archive.finalize();
});

router.get('/download-system', requireAuth, requireRole('super_admin', 'admin'), (req, res) => {
  const projectRoot = path.join(__dirname, '..', '..');

  const excludeNames = new Set([
    'node_modules',
    '.git',
    '.old',
    '.cache',
    '.config',
    '.local',
    '.upm',
    '.agents',
    'attached_assets',
    'automated-installation',
    'docker-install',
    '.replit',
    'replit.md',
    '.env',
    '.installed',
    'run.sh',
    'replit_zip_error_log.txt'
  ]);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="GODSend_CMS.zip"');

  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    console.error('[SYSTEM] Archive error:', err);
    if (!res.headersSent) {
      res.status(500).send('Error creating archive');
    }
  });

  archive.pipe(res);

  const envExample =
    '# GODSend CMS - Environment Variables\n' +
    '# Copy this file to .env and configure\n\n' +
    '# Database (MySQL for shared hosting)\n' +
    'DB_DIALECT=mysql\n' +
    'DB_HOST=localhost\n' +
    'DB_PORT=3306\n' +
    'DB_NAME=godsend\n' +
    'DB_USER=root\n' +
    'DB_PASS=\n\n' +
    '# Or use DATABASE_URL\n' +
    '# DATABASE_URL=mysql://user:pass@localhost:3306/godsend\n\n' +
    '# Server\n' +
    'PORT=3000\n' +
    'NODE_ENV=production\n' +
    'SESSION_SECRET=change-this-to-a-random-string\n\n' +
    '# Default Admin (created on first run)\n' +
    'ADMIN_USER=admin\n' +
    'ADMIN_PASS=admin123\n' +
    'ADMIN_EMAIL=admin@example.com\n\n' +
    '# API Access (set to true to allow Xbox plugin without WordPress auth)\n' +
    'API_OPEN_ACCESS=true\n\n' +
    '# Session cookie security\n' +
    '# Set to true only if your site uses HTTPS\n' +
    '# Leave as false for HTTP-only hosting\n' +
    'FORCE_HTTPS=false\n\n' +
    '# WebDAV (Pydio)\n' +
    '# Configure via Settings page in admin panel\n';

  archive.append(envExample, { name: 'GODSend/.env.example' });

  const installGuide =
    '# GODSend CMS - Installation Guide\n\n' +
    '## Requirements\n' +
    '- Node.js 18+\n' +
    '- MySQL 5.7+ or PostgreSQL 12+\n\n' +
    '## Installation\n\n' +
    '1. Extract this ZIP to your hosting directory\n' +
    '2. Copy `.env.example` to `.env` and configure your database\n' +
    '3. Run `npm install` to install dependencies\n' +
    '4. Run `node index.js` or `npm start` to start the server\n' +
    '5. Access the admin panel at http://your-domain:3000\n' +
    '6. Login with the default credentials (admin/admin123)\n\n' +
    '## MySQL Setup\n\n' +
    '```sql\n' +
    'CREATE DATABASE godsend CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n' +
    'CREATE USER \'godsend\'@\'localhost\' IDENTIFIED BY \'your-password\';\n' +
    'GRANT ALL PRIVILEGES ON godsend.* TO \'godsend\'@\'localhost\';\n' +
    'FLUSH PRIVILEGES;\n' +
    '```\n\n' +
    '## cPanel / Shared Hosting (LiteSpeed)\n\n' +
    '1. Create a MySQL database via cPanel\n' +
    '2. Upload files via File Manager or FTP\n' +
    '3. Set up Node.js App in cPanel:\n' +
    '   - Application root: your project folder (e.g. godsend)\n' +
    '   - Application startup file: **index.js**\n' +
    '4. Configure the .env file with your database credentials\n' +
    '5. Run `npm install` via Terminal\n' +
    '6. Access `/install` to run the setup wizard\n\n' +
    '> **Important**: The entry point must be `index.js` (not src/app.js).\n' +
    '> LiteSpeed/lsnode.js requires `index.js` at the project root.\n\n' +
    '## Environment Variables\n\n' +
    '| Variable | Description | Default |\n' +
    '|----------|-------------|----------|\n' +
    '| DB_DIALECT | mysql or postgres | postgres |\n' +
    '| DB_HOST | Database host | localhost |\n' +
    '| DB_PORT | Database port | 3306 |\n' +
    '| DB_NAME | Database name | godsend |\n' +
    '| DB_USER | Database user | root |\n' +
    '| DB_PASS | Database password | |\n' +
    '| PORT | Server port | 3000 |\n' +
    '| SESSION_SECRET | Session encryption key | |\n' +
    '| ADMIN_USER | Default admin username | admin |\n' +
    '| ADMIN_PASS | Default admin password | admin123 |\n' +
    '| API_OPEN_ACCESS | Allow API without auth (for Xbox plugin) | true |\n' +
    '| FORCE_HTTPS | Set to true if site uses HTTPS | false |\n';

  archive.append(installGuide, { name: 'GODSend/INSTALL.md' });

  archive.directory(projectRoot, 'GODSend', (entry) => {
    const parts = entry.name.split('/');
    for (const part of parts) {
      if (excludeNames.has(part)) return false;
    }
    return entry;
  });

  archive.finalize();
});

module.exports = router;
