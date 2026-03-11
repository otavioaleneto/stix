const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: { len: [3, 50] }
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.STRING(100),
    defaultValue: 'editor',
    allowNull: false
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'admins'
});

Admin.prototype.checkPassword = async function(password) {
  return bcrypt.compare(password, this.password_hash);
};

Admin.hashPassword = async function(password) {
  return bcrypt.hash(password, 12);
};

Admin.beforeCreate(async (admin) => {
  if (admin.password_hash && !admin.password_hash.startsWith('$2')) {
    admin.password_hash = await Admin.hashPassword(admin.password_hash);
  }
});

Admin.beforeUpdate(async (admin) => {
  if (admin.changed('password_hash') && !admin.password_hash.startsWith('$2')) {
    admin.password_hash = await Admin.hashPassword(admin.password_hash);
  }
});

module.exports = Admin;
