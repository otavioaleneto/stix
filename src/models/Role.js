const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AVAILABLE_PERMISSIONS = [
  { key: 'manage_games', label: 'Gerenciar Games', description: 'Criar, editar e excluir games' },
  { key: 'games_delete', label: 'Excluir Games', description: 'Permite excluir games', parent: 'manage_games' },
  { key: 'games_edit_others', label: 'Editar Games de Outros', description: 'Permite editar games criados por outros admins', parent: 'manage_games' },
  { key: 'manage_attributes', label: 'Gerenciar Atributos', description: 'Criar, editar e excluir atributos' },
  { key: 'manage_downloads', label: 'Gerenciar Downloads', description: 'Visualizar histórico de downloads' },
  { key: 'manage_users', label: 'Gerenciar Usuários', description: 'Visualizar e gerenciar usuários' },
  { key: 'manage_settings', label: 'Gerenciar Configurações', description: 'Alterar configurações do sistema' },
  { key: 'manage_admins', label: 'Gerenciar Admins', description: 'Criar, editar e excluir administradores' }
];

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  permissions: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: '[]',
    get() {
      const raw = this.getDataValue('permissions');
      try {
        return JSON.parse(raw || '[]');
      } catch (e) {
        return [];
      }
    },
    set(val) {
      this.setDataValue('permissions', JSON.stringify(val || []));
    }
  },
  is_system: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'roles'
});

Role.AVAILABLE_PERMISSIONS = AVAILABLE_PERMISSIONS;

Role.seedDefaults = async function() {
  const allPerms = AVAILABLE_PERMISSIONS.map(p => p.key);

  const defaults = [
    {
      name: 'super_admin',
      description: 'Acesso total ao sistema',
      permissions: allPerms,
      is_system: true
    },
    {
      name: 'admin',
      description: 'Acesso administrativo sem gerenciar admins',
      permissions: allPerms.filter(p => p !== 'manage_admins'),
      is_system: true
    },
    {
      name: 'editor',
      description: 'Apenas gerenciar games e atributos',
      permissions: ['manage_games', 'manage_attributes'],
      is_system: true
    }
  ];

  for (const def of defaults) {
    const existing = await Role.findOne({ where: { name: def.name } });
    if (!existing) {
      await Role.create(def);
    }
  }
};

Role.prototype.hasPermission = function(permission) {
  const perms = this.permissions;
  return Array.isArray(perms) && perms.includes(permission);
};

module.exports = Role;
