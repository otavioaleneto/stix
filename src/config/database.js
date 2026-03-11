const { Sequelize } = require('sequelize');

const dbConfig = {
  logging: false,
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  define: { timestamps: true, underscored: true }
};

function createConnection() {
  if (process.env.DATABASE_URL) {
    console.log('[DB] Using DATABASE_URL connection string');
    return new Sequelize(process.env.DATABASE_URL, {
      ...dbConfig,
      dialect: 'postgres',
      dialectOptions: {
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
      }
    });
  }

  const dialect = process.env.DB_DIALECT || process.env.DB_TYPE || 'mysql';
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || (dialect === 'mysql' ? '3306' : '5432'));
  const dbName = process.env.DB_NAME || 'godsend';
  const dbUser = process.env.DB_USER || 'root';

  console.log(`[DB] Config: dialect=${dialect} host=${host}:${port} database=${dbName} user=${dbUser}`);

  return new Sequelize(dbName, dbUser, process.env.DB_PASS || '', {
    host, port, dialect,
    ...dbConfig
  });
}

const sequelize = createConnection();

async function reconnect() {
  console.log('[DB] Reconnecting with updated config...');
  try {
    await sequelize.connectionManager.close();
  } catch (e) {
    console.log('[DB] Close old pool:', e.message);
  }

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306');
  const dbName = process.env.DB_NAME || 'godsend';
  const dbUser = process.env.DB_USER || 'root';
  const dbPass = process.env.DB_PASS || '';

  sequelize.config.host = host;
  sequelize.config.port = port;
  sequelize.config.database = dbName;
  sequelize.config.username = dbUser;
  sequelize.config.password = dbPass;

  if (sequelize.connectionManager.config) {
    sequelize.connectionManager.config.host = host;
    sequelize.connectionManager.config.port = port;
    sequelize.connectionManager.config.database = dbName;
    sequelize.connectionManager.config.username = dbUser;
    sequelize.connectionManager.config.password = dbPass;
  }

  try {
    await sequelize.connectionManager.initPools();
  } catch (e) {
    console.log('[DB] Pool reinit:', e.message);
  }

  await sequelize.authenticate();
  console.log(`[DB] Reconnected: host=${host}:${port} database=${dbName} user=${dbUser}`);
  return sequelize;
}

sequelize.reconnect = reconnect;

module.exports = sequelize;
