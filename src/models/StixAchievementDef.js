const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StixAchievementDef = sequelize.define('StixAchievementDef', {
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
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  icon: {
    type: DataTypes.STRING(100),
    allowNull: true,
    defaultValue: '🏆'
  },
  category: {
    type: DataTypes.ENUM('download', 'social', 'membership', 'special'),
    defaultValue: 'special',
    allowNull: false
  },
  auto_rule: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  }
}, {
  tableName: 'stix_achievement_defs'
});

StixAchievementDef.seedDefaults = async function() {
  const count = await StixAchievementDef.count();
  if (count > 0) return;

  const defaults = [
    { key: 'first_download', name: 'Primeiro Download', description: 'Fez o primeiro download', icon: '📥', category: 'download', auto_rule: { type: 'downloads', threshold: 1 }, sort_order: 1 },
    { key: 'downloads_10', name: '10 Downloads', description: 'Completou 10 downloads', icon: '📦', category: 'download', auto_rule: { type: 'downloads', threshold: 10 }, sort_order: 2 },
    { key: 'downloads_50', name: '50 Downloads', description: 'Completou 50 downloads', icon: '🎯', category: 'download', auto_rule: { type: 'downloads', threshold: 50 }, sort_order: 3 },
    { key: 'downloads_100', name: '100 Downloads', description: 'Completou 100 downloads', icon: '💎', category: 'download', auto_rule: { type: 'downloads', threshold: 100 }, sort_order: 4 },
    { key: 'gold_member', name: 'Membro Gold', description: 'Tem assinatura Gold', icon: '🥇', category: 'membership', auto_rule: { type: 'membership', level: 'gold' }, sort_order: 5 },
    { key: 'vip_member', name: 'Membro VIP', description: 'Tem assinatura VIP', icon: '👑', category: 'membership', auto_rule: { type: 'membership', level: 'vip' }, sort_order: 6 },
    { key: 'first_comment', name: 'Primeiro Comentário', description: 'Fez o primeiro comentário', icon: '💬', category: 'social', auto_rule: { type: 'comments', threshold: 1 }, sort_order: 7 },
    { key: 'first_room', name: 'Primeira Sala', description: 'Criou a primeira sala de jogo', icon: '🎮', category: 'social', auto_rule: { type: 'rooms', threshold: 1 }, sort_order: 8 },
    { key: 'social_butterfly_5_friends', name: 'Social', description: 'Fez 5 amigos', icon: '🦋', category: 'social', auto_rule: { type: 'friends', threshold: 5 }, sort_order: 9 }
  ];

  await StixAchievementDef.bulkCreate(defaults);
  console.log('[DB] Seeded default Stix achievement definitions');
};

module.exports = StixAchievementDef;
