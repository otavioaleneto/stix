const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserAchievement = sequelize.define('UserAchievement', {
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
  achievement_key: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  achievement_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  achievement_description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  icon: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  unlocked_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'user_achievements',
  indexes: [
    {
      unique: true,
      fields: ['user_profile_id', 'achievement_key']
    }
  ]
});

module.exports = UserAchievement;
