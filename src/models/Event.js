const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Event = sequelize.define('Event', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  admin_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  event_type: {
    type: DataTypes.STRING(100),
    defaultValue: 'outro'
  },
  cover_image_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  event_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  event_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  published: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'events',
  timestamps: true,
  underscored: true
});

module.exports = Event;
