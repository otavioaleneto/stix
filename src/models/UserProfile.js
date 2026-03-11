const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserProfile = sequelize.define('UserProfile', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  wp_user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  username: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  display_name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  avatar_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  level_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  level_name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  total_downloads: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  total_playtime_minutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  games_completed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  achievements_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  last_seen: {
    type: DataTypes.DATE,
    allowNull: true
  },
  push_subscription: {
    type: DataTypes.JSON,
    allowNull: true
  },
  primary_xuid: {
    type: DataTypes.STRING(32),
    allowNull: true
  },
  friend_code: {
    type: DataTypes.STRING(7),
    allowNull: true,
    unique: true
  }
}, {
  tableName: 'user_profiles'
});

module.exports = UserProfile;
