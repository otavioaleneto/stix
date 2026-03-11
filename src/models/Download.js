const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Download = sequelize.define('Download', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  game_file_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'game_files', key: 'id' }
  },
  game_title: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  file_name: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  file_size: {
    type: DataTypes.BIGINT,
    allowNull: true
  },
  bytes_transferred: {
    type: DataTypes.BIGINT,
    defaultValue: 0
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active',
    allowNull: false
  },
  client_ip: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  user_identifier: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  started_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  completed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'downloads'
});

module.exports = Download;
