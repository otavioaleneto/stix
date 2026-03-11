const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WordPressConfig = sequelize.define('WordPressConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  site_url: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  consumer_key: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  consumer_secret: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  last_synced: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'wordpress_configs'
});

module.exports = WordPressConfig;
