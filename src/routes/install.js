const express = require('express');
const router = express.Router();
const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

function createTempSequelize(config) {
  if (config.databaseUrl) {
    return new Sequelize(config.databaseUrl, {
      logging: false,
      dialectOptions: config.ssl ? { ssl: { rejectUnauthorized: false } } : {}
    });
  }
  return new Sequelize(config.dbName, config.dbUser, config.dbPass, {
    host: config.dbHost,
    port: parseInt(config.dbPort),
    dialect: config.dbDialect,
    logging: false
  });
}

async function installGuard(req, res, next) {
  const lockFile = path.join(__dirname, '..', '..', '.installed');
  if (fs.existsSync(lockFile)) {
    if (req.session && req.session.adminId && req.session.adminRole === 'super_admin') {
      return next();
    }
    if (req.method === 'POST' || req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(403).json({ success: false, message: 'Sistema ja instalado. Faca login como super_admin para acessar o wizard.' });
    }
    return res.redirect('/login');
  }
  next();
}

router.use(installGuard);

router.get('/', async (req, res) => {
  const installed = await checkInstalled();
  res.render('install', {
    installed,
    hasDbUrl: !!process.env.DATABASE_URL
  });
});

router.post('/test-db', async (req, res) => {
  try {
    const config = { ...req.body };
    if (config.databaseUrl === '__env__') {
      config.databaseUrl = process.env.DATABASE_URL;
    }
    const seq = createTempSequelize(config);
    await seq.authenticate();

    let hasData = false;
    let hasAdmins = false;
    let tableList = [];

    try {
      const qi = seq.getQueryInterface();
      tableList = await qi.showAllTables();
      hasData = tableList.length > 0;

      if (hasData && tableList.includes('admins')) {
        const [results] = await seq.query('SELECT COUNT(*) as cnt FROM admins');
        hasAdmins = results[0].cnt > 0;
      }
    } catch (e) {}

    await seq.close();

    res.json({
      success: true,
      hasData,
      hasAdmins,
      tables: tableList.length,
      dialect: seq.getDialect(),
      message: hasData
        ? `Banco conectado! ${tableList.length} tabelas encontradas.`
        : 'Banco conectado! Nenhuma tabela encontrada (instalacao limpa).'
    });
  } catch (err) {
    res.json({
      success: false,
      message: 'Falha na conexao: ' + err.message
    });
  }
});

router.post('/check-permissions', async (req, res) => {
  const checks = [];
  const basePath = path.join(__dirname, '..', '..');
  const srcPath = path.join(__dirname, '..');

  const foldersToCheck = [
    { path: basePath, label: 'Raiz do projeto', required: true },
    { path: srcPath, label: 'src/', required: true },
    { path: path.join(srcPath, 'public'), label: 'src/public/', required: true },
    { path: path.join(srcPath, 'public', 'uploads'), label: 'src/public/uploads/', required: true },
    { path: path.join(srcPath, 'public', 'plugin'), label: 'src/public/plugin/', required: false }
  ];

  for (const folder of foldersToCheck) {
    const check = { label: folder.label, required: folder.required };
    try {
      if (!fs.existsSync(folder.path)) {
        try {
          fs.mkdirSync(folder.path, { recursive: true });
          check.exists = true;
          check.writable = true;
          check.status = 'created';
        } catch (mkErr) {
          check.exists = false;
          check.writable = false;
          check.status = 'missing';
          check.error = mkErr.message;
        }
      } else {
        check.exists = true;
        const testFile = path.join(folder.path, '.write-test-' + Date.now());
        try {
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          check.writable = true;
          check.status = 'ok';
        } catch (writeErr) {
          check.writable = false;
          check.status = 'no-write';
          check.error = writeErr.message;
        }
      }
    } catch (e) {
      check.exists = false;
      check.writable = false;
      check.status = 'error';
      check.error = e.message;
    }
    checks.push(check);
  }

  const envWritable = (() => {
    try {
      const envPath = path.join(basePath, '.env');
      if (fs.existsSync(envPath)) {
        fs.accessSync(envPath, fs.constants.W_OK);
        return true;
      }
      const testEnv = envPath + '.test';
      fs.writeFileSync(testEnv, '');
      fs.unlinkSync(testEnv);
      return true;
    } catch (e) {
      return false;
    }
  })();

  const allOk = checks.every(c => !c.required || (c.exists && c.writable));

  res.json({
    success: true,
    allOk,
    envWritable,
    checks
  });
});

router.post('/setup', async (req, res) => {
  try {
    let { dbDialect, dbHost, dbPort, dbName, dbUser, dbPass, databaseUrl, ssl,
            adminUsername, adminEmail, adminPassword } = req.body;

    if (databaseUrl === '__env__') {
      databaseUrl = process.env.DATABASE_URL;
    }

    const envPath = path.join(__dirname, '..', '..', '.env');

    if (!process.env.DATABASE_URL && !databaseUrl) {
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }

      const dbVars = {
        DB_DIALECT: dbDialect || 'mysql',
        DB_HOST: dbHost || 'localhost',
        DB_PORT: dbPort || '3306',
        DB_NAME: dbName || 'godsend',
        DB_USER: dbUser || 'root',
        DB_PASS: dbPass || ''
      };

      for (const [key, val] of Object.entries(dbVars)) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${val}`);
        } else {
          envContent += `${key}=${val}\n`;
        }
      }

      if (!envContent.includes('SESSION_SECRET=')) {
        const secret = require('crypto').randomBytes(32).toString('hex');
        envContent += `SESSION_SECRET=${secret}\n`;
      }

      if (!envContent.includes('API_OPEN_ACCESS=')) {
        envContent += `API_OPEN_ACCESS=true\n`;
      }

      if (!envContent.includes('FORCE_HTTPS=')) {
        envContent += `FORCE_HTTPS=false\n`;
      }

      fs.writeFileSync(envPath, envContent);

      process.env.DB_DIALECT = dbVars.DB_DIALECT;
      process.env.DB_HOST = dbVars.DB_HOST;
      process.env.DB_PORT = dbVars.DB_PORT;
      process.env.DB_NAME = dbVars.DB_NAME;
      process.env.DB_USER = dbVars.DB_USER;
      process.env.DB_PASS = dbVars.DB_PASS;
    }

    if (databaseUrl) {
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      }
      const regex = /^DATABASE_URL=.*$/m;
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `DATABASE_URL=${databaseUrl}`);
      } else {
        envContent += `DATABASE_URL=${databaseUrl}\n`;
      }
      fs.writeFileSync(envPath, envContent);
      process.env.DATABASE_URL = databaseUrl;
    }

    const config = databaseUrl
      ? { databaseUrl, ssl: ssl === 'true' || ssl === true }
      : { dbDialect, dbHost, dbPort, dbName, dbUser, dbPass };
    const seq = createTempSequelize(config);

    await seq.authenticate();

    const Admin = seq.define('Admin', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      username: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      role: { type: Sequelize.ENUM('super_admin', 'admin', 'editor'), defaultValue: 'editor' },
      active: { type: Sequelize.BOOLEAN, defaultValue: true }
    }, { tableName: 'admins', timestamps: true, underscored: true });

    const Game = seq.define('Game', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      title: { type: Sequelize.STRING(255), allowNull: false },
      slug: { type: Sequelize.STRING(255), unique: true },
      cover_image: Sequelize.STRING(500),
      description: Sequelize.TEXT,
      publisher: Sequelize.STRING(255),
      release_date: Sequelize.STRING(20),
      youtube_trailer_url: Sequelize.STRING(500),
      platform: { type: Sequelize.ENUM('xbox360', 'xbox_original', 'digital'), defaultValue: 'xbox360' },
      status: { type: Sequelize.ENUM('active', 'inactive'), defaultValue: 'active' }
    }, { tableName: 'games', timestamps: true, underscored: true });

    const GameFile = seq.define('GameFile', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      game_id: { type: Sequelize.INTEGER, allowNull: false },
      file_type: { type: Sequelize.ENUM('game', 'dlc', 'tu', 'translation'), defaultValue: 'game' },
      label: Sequelize.STRING(255),
      server_path: Sequelize.STRING(500),
      folder_path: Sequelize.STRING(500),
      title_id: Sequelize.STRING(20),
      media_id: Sequelize.STRING(20),
      file_size: Sequelize.BIGINT
    }, { tableName: 'game_files', timestamps: true, underscored: true });

    const WebDAVConfig = seq.define('WebDAVConfig', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      server_url: Sequelize.STRING(500),
      username: Sequelize.STRING(255),
      password_encrypted: Sequelize.STRING(500),
      is_active: { type: Sequelize.BOOLEAN, defaultValue: false },
      last_checked: Sequelize.DATE
    }, { tableName: 'webdav_configs', timestamps: true, underscored: true });

    const WordPressConfig = seq.define('WordPressConfig', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      site_url: Sequelize.STRING(500),
      api_key: Sequelize.STRING(500),
      is_active: { type: Sequelize.BOOLEAN, defaultValue: false },
      last_synced: Sequelize.DATE
    }, { tableName: 'wordpress_configs', timestamps: true, underscored: true });

    await seq.sync({ alter: true });

    const [adminResults] = await seq.query('SELECT COUNT(*) as cnt FROM admins');
    const adminCount = parseInt(adminResults[0].cnt);
    let adminCreated = false;

    if (adminCount === 0 && adminUsername && adminPassword) {
      const hash = await bcrypt.hash(adminPassword, 12);
      await Admin.create({
        username: adminUsername,
        email: adminEmail || `${adminUsername}@godsend.local`,
        password_hash: hash,
        role: 'super_admin',
        active: true
      });
      adminCreated = true;
    }

    const lockPath = path.join(__dirname, '..', '..', '.installed');
    fs.writeFileSync(lockPath, JSON.stringify({
      installedAt: new Date().toISOString(),
      dialect: seq.getDialect()
    }));

    await seq.close();

    let reinitOk = false;
    try {
      const app = req.app;
      if (app.reinitDatabase) {
        reinitOk = await app.reinitDatabase();
        if (reinitOk) {
          console.log('[INSTALL] App database reinitialized - login will work without restart.');
        }
      }
    } catch (reinitErr) {
      console.error('[INSTALL] Failed to reinitialize app database:', reinitErr.message);
    }

    res.json({
      success: true,
      adminCreated,
      adminExists: adminCount > 0,
      reinitOk,
      needsRestart: !reinitOk,
      message: adminCreated
        ? 'Sistema instalado com sucesso! Admin criado.'
        : adminCount > 0
          ? 'Banco de dados atualizado com sucesso! Admin existente mantido.'
          : 'Tabelas criadas. Faca login com o admin padrao.'
    });
  } catch (err) {
    console.error('[INSTALL] Setup error:', err.message);
    console.error('[INSTALL] Stack:', err.stack);
    res.json({
      success: false,
      message: 'Erro na instalacao: ' + err.message
    });
  }
});

async function checkInstalled() {
  try {
    const sequelize = require('../config/database');
    await sequelize.authenticate();
    const [results] = await sequelize.query('SELECT COUNT(*) as cnt FROM admins');
    return parseInt(results[0].cnt) > 0;
  } catch (e) {
    return false;
  }
}

router.checkInstalled = checkInstalled;

module.exports = router;
