const { Role } = require('../models');

exports.index = async (req, res) => {
  try {
    const roles = await Role.findAll({ order: [['is_system', 'DESC'], ['name', 'ASC']] });
    res.render('admins/roles', {
      title: 'Cargos e Permissões',
      roles,
      availablePermissions: Role.AVAILABLE_PERMISSIONS,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('[ROLES] Index error:', error);
    res.render('admins/roles', {
      title: 'Cargos e Permissões',
      roles: [],
      availablePermissions: Role.AVAILABLE_PERMISSIONS,
      error: 'Erro ao carregar cargos.',
      success: null
    });
  }
};

exports.store = async (req, res) => {
  try {
    const { name, description } = req.body;
    let permissions = req.body.permissions || [];
    if (typeof permissions === 'string') permissions = [permissions];

    await Role.create({
      name: name.toLowerCase().replace(/\s+/g, '_'),
      description,
      permissions,
      is_system: false
    });

    const roles = await Role.findAll({ order: [['is_system', 'DESC'], ['name', 'ASC']] });
    res.render('admins/roles', {
      title: 'Cargos e Permissões',
      roles,
      availablePermissions: Role.AVAILABLE_PERMISSIONS,
      error: null,
      success: 'Cargo criado com sucesso!'
    });
  } catch (error) {
    console.error('[ROLES] Store error:', error);
    const roles = await Role.findAll({ order: [['is_system', 'DESC'], ['name', 'ASC']] });
    res.render('admins/roles', {
      title: 'Cargos e Permissões',
      roles,
      availablePermissions: Role.AVAILABLE_PERMISSIONS,
      error: error.message.includes('unique') ? 'Já existe um cargo com este nome.' : error.message,
      success: null
    });
  }
};

exports.update = async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.redirect('/admins/roles');

    const { description } = req.body;
    let permissions = req.body.permissions || [];
    if (typeof permissions === 'string') permissions = [permissions];

    const updateData = { description, permissions };
    if (!role.is_system) {
      const name = req.body.name;
      if (name) updateData.name = name.toLowerCase().replace(/\s+/g, '_');
    }

    await role.update(updateData);

    const roles = await Role.findAll({ order: [['is_system', 'DESC'], ['name', 'ASC']] });
    res.render('admins/roles', {
      title: 'Cargos e Permissões',
      roles,
      availablePermissions: Role.AVAILABLE_PERMISSIONS,
      error: null,
      success: 'Cargo atualizado com sucesso!'
    });
  } catch (error) {
    console.error('[ROLES] Update error:', error);
    const roles = await Role.findAll({ order: [['is_system', 'DESC'], ['name', 'ASC']] });
    res.render('admins/roles', {
      title: 'Cargos e Permissões',
      roles,
      availablePermissions: Role.AVAILABLE_PERMISSIONS,
      error: error.message,
      success: null
    });
  }
};

exports.destroy = async (req, res) => {
  try {
    const role = await Role.findByPk(req.params.id);
    if (!role) return res.redirect('/admins/roles');

    if (role.is_system) {
      const roles = await Role.findAll({ order: [['is_system', 'DESC'], ['name', 'ASC']] });
      return res.render('admins/roles', {
        title: 'Cargos e Permissões',
        roles,
        availablePermissions: Role.AVAILABLE_PERMISSIONS,
        error: 'Cargos do sistema não podem ser excluídos.',
        success: null
      });
    }

    await role.destroy();
    const roles = await Role.findAll({ order: [['is_system', 'DESC'], ['name', 'ASC']] });
    res.render('admins/roles', {
      title: 'Cargos e Permissões',
      roles,
      availablePermissions: Role.AVAILABLE_PERMISSIONS,
      error: null,
      success: 'Cargo excluído com sucesso!'
    });
  } catch (error) {
    console.error('[ROLES] Destroy error:', error);
    res.redirect('/admins/roles');
  }
};
