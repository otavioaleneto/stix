const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attribute = sequelize.define('Attribute', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  value: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  label: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  }
}, {
  tableName: 'attributes'
});

Attribute.seedDefaults = async function() {
  const count = await Attribute.count();
  if (count === 0) {
    const defaults = [
      { category: 'file_type', value: 'game', label: 'Jogo', sort_order: 1 },
      { category: 'file_type', value: 'dlc', label: 'DLC', sort_order: 2 },
      { category: 'file_type', value: 'tu', label: 'TU (Title Update)', sort_order: 3 },
      { category: 'file_type', value: 'translation', label: 'Traducao', sort_order: 4 },
      { category: 'platform', value: 'xbox360', label: 'Xbox 360', sort_order: 1 },
      { category: 'platform', value: 'xbox_original', label: 'Xbox Original', sort_order: 2 },
      { category: 'platform', value: 'digital', label: 'Digital / XBLA', sort_order: 3 }
    ];
    await Attribute.bulkCreate(defaults);
    console.log('[DB] Default attributes seeded.');
  }

  const catCount = await Attribute.count({ where: { category: 'category' } });
  if (catCount === 0) {
    const categoryDefaults = [
      { category: 'category', value: 'acao', label: 'Ação', sort_order: 1 },
      { category: 'category', value: 'aventura', label: 'Aventura', sort_order: 2 },
      { category: 'category', value: 'fps', label: 'FPS', sort_order: 3 },
      { category: 'category', value: 'rpg', label: 'RPG', sort_order: 4 },
      { category: 'category', value: 'corrida', label: 'Corrida', sort_order: 5 },
      { category: 'category', value: 'esportes', label: 'Esportes', sort_order: 6 },
      { category: 'category', value: 'plataforma', label: 'Plataforma', sort_order: 7 },
      { category: 'category', value: 'luta', label: 'Luta', sort_order: 8 },
      { category: 'category', value: 'estrategia', label: 'Estratégia', sort_order: 9 },
      { category: 'category', value: 'puzzle', label: 'Puzzle', sort_order: 10 },
      { category: 'category', value: 'terror', label: 'Terror', sort_order: 11 },
      { category: 'category', value: 'simulacao', label: 'Simulação', sort_order: 12 }
    ];
    await Attribute.bulkCreate(categoryDefaults);
    console.log('[DB] Default categories seeded.');
  }
};

module.exports = Attribute;
