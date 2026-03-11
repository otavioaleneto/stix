const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Game = sequelize.define('Game', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  cover_image: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  publisher: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  release_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  youtube_trailer_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  title_id: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  platform: {
    type: DataTypes.STRING(50),
    defaultValue: 'xbox360',
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'standby'),
    defaultValue: 'active',
    allowNull: false
  },
  created_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null
  }
}, {
  tableName: 'games'
});

Game.generateSlug = function(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 250);
};

module.exports = Game;
