const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BlogComment = sequelize.define('BlogComment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  blog_post_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'blog_posts', key: 'id' }
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
  tableName: 'blog_comments'
});

module.exports = BlogComment;
