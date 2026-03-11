const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BlogPost = sequelize.define('BlogPost', {
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
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  cover_image_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  published: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  published_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  category_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'blog_categories',
      key: 'id'
    }
  },
  pinned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'blog_posts',
  timestamps: true,
  underscored: true
});

module.exports = BlogPost;
