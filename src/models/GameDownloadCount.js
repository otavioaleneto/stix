const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameDownloadCount = sequelize.define('GameDownloadCount', {
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
  console_id: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'game_download_counts',
  indexes: [
    {
      unique: true,
      fields: ['game_id', 'console_id']
    }
  ]
});

module.exports = GameDownloadCount;
