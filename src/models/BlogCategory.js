const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BlogCategory = sequelize.define('BlogCategory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING(120),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true
  }
}, {
  tableName: 'blog_categories',
  timestamps: true,
  underscored: true
});

module.exports = BlogCategory;
