const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameComment = sequelize.define('GameComment', {
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
  user_profile_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'user_profiles', key: 'id' }
  },
  comment_text: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  tableName: 'game_comments'
});

module.exports = GameComment;
