const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WebDAVConfig = sequelize.define('WebDAVConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  server_url: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  username: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  password_encrypted: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  last_checked: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'webdav_configs'
});

module.exports = WebDAVConfig;
