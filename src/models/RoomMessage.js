const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RoomMessage = sequelize.define('RoomMessage', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  room_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'game_rooms', key: 'id' }
  },
  user_profile_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'user_profiles', key: 'id' }
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  tableName: 'room_messages',
  updatedAt: false
});

module.exports = RoomMessage;
