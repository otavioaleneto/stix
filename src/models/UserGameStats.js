const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserGameStats = sequelize.define('UserGameStats', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_profile_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'user_profiles', key: 'id' }
  },
  game_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'games', key: 'id' }
  },
  title_id: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  playtime_minutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  last_played: {
    type: DataTypes.DATE,
    allowNull: true
  },
  times_launched: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  completed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'user_game_stats',
  indexes: [
    {
      unique: true,
      fields: ['user_profile_id', 'game_id']
    }
  ]
});

module.exports = UserGameStats;
