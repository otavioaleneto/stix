require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const CMS_VERSION = '2.0.0';

console.log('[GODSend] Starting up...');
console.log('[GODSend] Node.js', process.version);
console.log('[GODSend] Working directory:', process.cwd());

const requiredDirs = [
  path.join(__dirname, 'public'),
  path.join(__dirname, 'public', 'uploads'),
  path.join(__dirname, 'public', 'plugin'),
  path.join(__dirname, 'public', 'plugin', 'Icon'),
  path.join(__dirname, 'views'),
  path.join(__dirname, 'views', 'partials'),
  path.join(__dirname, 'views', 'games'),
  path.join(__dirname, 'views', 'admins'),
  path.join(__dirname, 'views', 'users'),
  path.join(__dirname, 'views', 'access'),
  path.join(__dirname, 'views', 'settings')
];

for (const dir of requiredDirs) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('[STARTUP] Created missing directory:', dir);
    }
  } catch (err) {
    console.error('[STARTUP] FAILED to create directory:', dir, '-', err.message);
    console.error('[STARTUP] Fix: Run "chmod -R 775 ' + path.relative(process.cwd(), dir) + '" or create it manually via cPanel File Manager');
  }
}

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  console.log('[STARTUP] .env file: found');
} else {
  console.log('[STARTUP] .env file: NOT FOUND - using environment variables or defaults');
  console.log('[STARTUP] Copy .env.example to .env and configure your database');
}

console.log('[STARTUP] DB config:', {
  DATABASE_URL: process.env.DATABASE_URL ? '(set)' : '(not set)',
  DB_DIALECT: process.env.DB_DIALECT || process.env.DB_TYPE || '(default: mysql)',
  DB_HOST: process.env.DB_HOST || '(default: localhost)',
  DB_PORT: process.env.DB_PORT || '(default)',
  DB_NAME: process.env.DB_NAME || '(default: godsend)',
  DB_USER: process.env.DB_USER || '(default: root)',
  DB_PASS: process.env.DB_PASS ? '(set)' : '(empty)',
  API_OPEN_ACCESS: process.env.API_OPEN_ACCESS || '(not set - API will require auth)',
  FORCE_HTTPS: process.env.FORCE_HTTPS || 'false',
  SESSION_SECRET: process.env.SESSION_SECRET ? '(set)' : '(using default - change in production!)'
});

const SequelizeStore = require('connect-session-sequelize')(session.Store);
const sequelize = require('./config/database');
const { initDatabase } = require('./models');
const { loadAdmin } = require('./middleware/auth');
const installRouter = require('./routes/install');

const app = express();
const PORT = process.env.PORT || 5000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

let sessionStore = new SequelizeStore({ db: sequelize });

app.set('trust proxy', 1);

app.use((req, res, next) => {
  session({
    secret: process.env.SESSION_SECRET || 'godsend-secret-key-change-me',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: process.env.FORCE_HTTPS === 'true',
      sameSite: 'lax'
    }
  })(req, res, next);
});

app.use('/install', installRouter);

app.use(async (req, res, next) => {
  if (req.path.startsWith('/install') || req.path.startsWith('/api/') || req.path.startsWith('/plugin/')) {
    return next();
  }

  const lockFile = path.join(__dirname, '..', '.installed');
  if (fs.existsSync(lockFile)) {
    return next();
  }

  const installed = await installRouter.checkInstalled();
  if (!installed) {
    return res.redirect('/install');
  }

  fs.writeFileSync(lockFile, JSON.stringify({
    installedAt: new Date().toISOString(),
    autoDetected: true
  }));
  next();
});

app.use(loadAdmin);

app.use('/', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/games', require('./routes/games'));
app.use('/attributes', require('./routes/attributes'));
app.use('/downloads', require('./routes/downloads'));
app.use('/admins', require('./routes/admins'));
app.use('/users', require('./routes/users'));
app.use('/access', require('./routes/access'));
app.use('/settings', require('./routes/settings'));
app.use('/api', require('./routes/api'));
app.use('/api', require('./routes/profile'));
app.use('/api/rooms', require('./routes/rooms'));
app.use('/plugin', require('./routes/plugin'));
app.use('/update', require('./routes/update'));
app.use('/about', require('./routes/about'));
app.use('/consoles', require('./routes/consoles'));
app.use('/reports', require('./routes/reports'));
app.use('/social', require('./routes/social'));
app.use('/blog/categories', require('./routes/blogCategories'));
app.use('/blog', require('./routes/blog'));
app.use('/events/types', require('./routes/eventTypes'));
app.use('/events', require('./routes/events'));

app.locals.CMS_VERSION = CMS_VERSION;

app.get('/', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

app.use((req, res) => {
  res.status(404).render('error', {
    title: '404',
    message: 'Pagina nao encontrada',
    admin: res.locals.admin
  });
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  console.error('[ERROR] Path:', req.method, req.originalUrl);
  console.error('[ERROR] Stack:', err.stack);
  res.status(500).render('error', {
    title: 'Erro',
    message: 'Erro interno do servidor: ' + err.message,
    admin: res.locals.admin
  });
});

app.reinitDatabase = async function() {
  console.log('[APP] Reinitializing database connection after install...');
  try {
    await sequelize.reconnect();

    await sequelize.sync({ alter: true });
    console.log('[APP] Models re-synced with new connection.');

    sessionStore = new SequelizeStore({ db: sequelize });
    await sessionStore.sync();
    console.log('[APP] Session store reinitialized.');

    console.log('[APP] Database reinitialized successfully - login will work without restart.');
    return true;
  } catch (err) {
    console.error('[APP] Failed to reinitialize database:', err.message);
    console.error('[APP] Stack:', err.stack);
    return false;
  }
};

async function start() {
  const dbOk = await initDatabase();
  if (!dbOk) {
    console.log('[WARN] Database not available. Install wizard will be shown at /install');
    console.log('[WARN] If this is a fresh install, this is expected.');
  } else {
    console.log('[STARTUP] Database: OK');
  }

  try {
    await sessionStore.sync();
    console.log('[STARTUP] Session store: OK');
  } catch (e) {
    console.log('[WARN] Session store sync failed:', e.message);
    console.log('[WARN] Sessions will be available after install wizard completes.');
  }

  try {
    const roomController = require('./controllers/roomController');
    roomController.autoCompleteRooms();
  } catch (e) {}

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GODSend] Server running on http://0.0.0.0:${PORT}`);

    const lockFile = path.join(__dirname, '..', '.installed');
    if (!fs.existsSync(lockFile)) {
      console.log('[GODSend] First run detected. Go to /install to set up the system.');
    } else {
      console.log('[GODSend] System is installed. Login at /login');
    }
  });
}

module.exports = app;

start().catch(err => {
  console.error('[FATAL] Server failed to start:', err.message);
  console.error('[FATAL] Stack:', err.stack);
  process.exit(1);
});
