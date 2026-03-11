const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PydioConfig = sequelize.define('PydioConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  base_url: {
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
  workspace: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: 'personal-files'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  last_checked: {
    type: DataTypes.DATE,
    allowNull: true
  },
  warp_proxy_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  warp_proxy_port: {
    type: DataTypes.INTEGER,
    defaultValue: 40000
  },
  cdn_proxy_url: {
    type: DataTypes.STRING(500),
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'pydio_configs'
});

module.exports = PydioConfig;
