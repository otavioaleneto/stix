const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
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
  type: {
    type: DataTypes.ENUM('friend_request', 'room_invite', 'room_reminder', 'achievement'),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  data: {
    type: DataTypes.JSON,
    allowNull: true
  },
  read: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'notifications'
});

module.exports = Notification;
