const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameFavorite = sequelize.define('GameFavorite', {
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
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  tableName: 'game_favorites',
  indexes: [
    {
      unique: true,
      fields: ['game_id', 'user_id']
    }
  ]
});

module.exports = GameFavorite;
