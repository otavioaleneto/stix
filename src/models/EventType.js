const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EventType = sequelize.define('EventType', {
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
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  color: {
    type: DataTypes.STRING(20),
    allowNull: true,
    defaultValue: '#8b8ba3'
  }
}, {
  tableName: 'event_types',
  timestamps: true,
  underscored: true
});

EventType.seedDefaults = async function() {
  try {
    const count = await EventType.count();
    if (count === 0) {
      await EventType.bulkCreate([
        { name: 'Sorteio', slug: 'sorteio', color: '#a78bfa' },
        { name: 'Live', slug: 'live', color: '#ef4444' },
        { name: 'Torneio', slug: 'torneio', color: '#f59e0b' },
        { name: 'Outro', slug: 'outro', color: '#8b8ba3' }
      ]);
      console.log('[DB] Default event types seeded.');
    }
  } catch (err) {
    console.error('[DB] EventType seed error:', err.message);
  }
};

module.exports = EventType;
