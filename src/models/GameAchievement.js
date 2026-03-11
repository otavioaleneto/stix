const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameAchievement = sequelize.define('GameAchievement', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  game_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'games', key: 'id' }
  },
  title_id: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  achievement_id: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  image_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  gamerscore: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0
  }
}, {
  tableName: 'game_achievements',
  indexes: [
    {
      unique: true,
      fields: ['title_id', 'achievement_id']
    }
  ]
});

module.exports = GameAchievement;
