const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameFile = sequelize.define('GameFile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  game_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'games', key: 'id' }
  },
  file_type: {
    type: DataTypes.STRING(50),
    defaultValue: 'game',
    allowNull: false
  },
  label: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  server_path: {
    type: DataTypes.STRING(1000),
    allowNull: false
  },
  folder_path: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  title_id: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  media_id: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  file_size: {
    type: DataTypes.BIGINT,
    allowNull: true
  }
}, {
  tableName: 'game_files'
});

module.exports = GameFile;
