const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameRoom = sequelize.define('GameRoom', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  creator_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'user_profiles', key: 'id' }
  },
  game_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'games', key: 'id' }
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  game_title: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  scheduled_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  timezone: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'America/Sao_Paulo'
  },
  max_players: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 4
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  server_type: {
    type: DataTypes.ENUM('system_link', 'stealth_server'),
    allowNull: false,
    defaultValue: 'system_link'
  },
  status: {
    type: DataTypes.ENUM('scheduled', 'active', 'finished', 'cancelled'),
    allowNull: false,
    defaultValue: 'scheduled'
  }
}, {
  tableName: 'game_rooms'
});

module.exports = GameRoom;
