const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameRating = sequelize.define('GameRating', {
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
  user_identifier: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 }
  }
}, {
  tableName: 'game_ratings',
  indexes: [
    {
      unique: true,
      fields: ['game_id', 'user_identifier']
    }
  ]
});

module.exports = GameRating;
