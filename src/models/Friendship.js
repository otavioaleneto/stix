const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Friendship = sequelize.define('Friendship', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  requester_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'user_profiles', key: 'id' }
  },
  addressee_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'user_profiles', key: 'id' }
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
    allowNull: false,
    defaultValue: 'pending'
  }
}, {
  tableName: 'friendships',
  indexes: [
    {
      unique: true,
      fields: ['requester_id', 'addressee_id']
    }
  ]
});

module.exports = Friendship;
