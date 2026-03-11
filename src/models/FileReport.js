const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FileReport = sequelize.define('FileReport', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  game_file_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  game_title: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  file_name: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  file_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  report_type: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  console_id: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'file_reports'
});

module.exports = FileReport;
