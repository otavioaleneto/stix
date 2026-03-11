const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ConsoleDownload = sequelize.define('ConsoleDownload', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  console_id: {
    type: DataTypes.STRING(64),
    allowNull: false
  },
  downloads_today: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  last_download_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  total_downloads: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  first_seen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  last_seen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  banned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'console_downloads',
  timestamps: false,
  indexes: [
    { unique: true, fields: ['console_id'] }
  ]
});

module.exports = ConsoleDownload;
