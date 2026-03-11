const { Admin, Role } = require('../models');

async function getRoleNames() {
  try {
    const roles = await Role.findAll({ order: [['is_system', 'DESC'], ['name', 'ASC']] });
    return roles.map(r => ({ name: r.name, description: r.description }));
  } catch (e) {
    return [
      { name: 'super_admin', description: 'Super Admin' },
      { name: 'admin', description: 'Admin' },
      { name: 'editor', description: 'Editor' }
    ];
  }
}

exports.index = async (req, res) => {
  try {
    const admins = await Admin.findAll({ order: [['created_at', 'DESC']] });
    res.render('admins/index', { title: 'Administradores', admins });
  } catch (error) {
    console.error('[ADMINS] Index error:', error);
    res.render('admins/index', { title: 'Administradores', admins: [] });
  }
};

exports.create = async (req, res) => {
  const roles = await getRoleNames();
  res.render('admins/form', { title: 'Novo Admin', adminData: null, error: null, roles });
};

exports.store = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    await Admin.create({
      username, email, password_hash: password,
      role: role || 'editor', active: true
    });
    res.redirect('/admins');
  } catch (error) {
    console.error('[ADMINS] Store error:', error);
    const roles = await getRoleNames();
    res.render('admins/form', {
      title: 'Novo Admin', adminData: req.body, error: error.message, roles
    });
  }
};

exports.edit = async (req, res) => {
  try {
    const adminData = await Admin.findByPk(req.params.id);
    if (!adminData) return res.redirect('/admins');
    const roles = await getRoleNames();
    res.render('admins/form', { title: 'Editar Admin', adminData, error: null, roles });
  } catch (error) {
    res.redirect('/admins');
  }
};

exports.update = async (req, res) => {
  try {
    const admin = await Admin.findByPk(req.params.id);
    if (!admin) return res.redirect('/admins');

    const { username, email, password, role, active } = req.body;
    const updateData = { username, email, role };
    updateData.active = active === 'on' || active === 'true' || active === '1';

    if (password && password.length > 0) {
      updateData.password_hash = password;
    }

    await admin.update(updateData);
    res.redirect('/admins');
  } catch (error) {
    console.error('[ADMINS] Update error:', error);
    res.redirect(`/admins/${req.params.id}/edit`);
  }
};

exports.destroy = async (req, res) => {
  try {
    const admin = await Admin.findByPk(req.params.id);
    if (!admin) return res.redirect('/admins');

    if (admin.role === 'super_admin') {
      const superCount = await Admin.count({ where: { role: 'super_admin' } });
      if (superCount <= 1) {
        return res.redirect('/admins');
      }
    }

    await admin.destroy();
    res.redirect('/admins');
  } catch (error) {
    console.error('[ADMINS] Destroy error:', error);
    res.redirect('/admins');
  }
};
