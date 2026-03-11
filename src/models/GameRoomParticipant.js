const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameRoomParticipant = sequelize.define('GameRoomParticipant', {
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
  status: {
    type: DataTypes.ENUM('invited', 'confirmed', 'declined', 'joined'),
    allowNull: false,
    defaultValue: 'invited'
  },
  invited_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  responded_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'game_room_participants',
  indexes: [
    {
      unique: true,
      fields: ['room_id', 'user_profile_id']
    }
  ]
});

module.exports = GameRoomParticipant;
