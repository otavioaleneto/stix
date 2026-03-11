const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GameCategory = sequelize.define('GameCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  game_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  category_value: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'game_categories',
  timestamps: false,
  indexes: [
    { fields: ['game_id'] },
    { fields: ['category_value'] },
    { unique: true, fields: ['game_id', 'category_value'] }
  ]
});

module.exports = GameCategory;
