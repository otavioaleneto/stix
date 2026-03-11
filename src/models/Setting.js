const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Setting = sequelize.define('Setting', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'settings'
});

Setting.get = async function(key, defaultValue = null) {
  const setting = await Setting.findOne({ where: { key } });
  return setting ? setting.value : defaultValue;
};

Setting.set = async function(key, value) {
  const [setting, created] = await Setting.findOrCreate({
    where: { key },
    defaults: { value }
  });
  if (!created) {
    await setting.update({ value });
  }
  return setting;
};

module.exports = Setting;
