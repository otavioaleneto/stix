function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.adminId) {
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.adminRole)) {
      return res.status(403).render('error', {
        title: 'Acesso Negado',
        message: 'Você não tem permissão para acessar esta página.',
        admin: req.session
      });
    }
    next();
  };
}

function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.session || !req.session.adminId) {
      return res.redirect('/login');
    }
    try {
      const Role = require('../models/Role');
      const role = await Role.findOne({ where: { name: req.session.adminRole } });
      if (role && role.hasPermission(permission)) {
        return next();
      }
      if (req.session.adminRole === 'super_admin') {
        return next();
      }
      return res.status(403).render('error', {
        title: 'Acesso Negado',
        message: 'Você não tem permissão para acessar esta página.',
        admin: req.session
      });
    } catch (error) {
      console.error('[AUTH] Permission check error:', error);
      if (req.session.adminRole === 'super_admin') {
        return next();
      }
      return res.status(403).render('error', {
        title: 'Acesso Negado',
        message: 'Erro ao verificar permissões.',
        admin: req.session
      });
    }
  };
}

async function loadAdmin(req, res, next) {
  res.locals.admin = req.session.adminId ? {
    id: req.session.adminId,
    username: req.session.adminUsername,
    role: req.session.adminRole,
    email: req.session.adminEmail
  } : null;
  res.locals.currentPath = req.path;
  res.locals.permissions = {};

  if (res.locals.admin) {
    try {
      const Role = require('../models/Role');
      const role = await Role.findOne({ where: { name: res.locals.admin.role } });
      if (role) {
        const permsArray = role.permissions || [];
        if (Array.isArray(permsArray)) {
          const permsObj = {};
          permsArray.forEach(p => { permsObj[p] = true; });
          res.locals.permissions = permsObj;
        } else {
          res.locals.permissions = permsArray;
        }
      }
      if (res.locals.admin.role === 'super_admin') {
        res.locals.permissions = {
          manage_games: true, games_delete: true, games_edit_others: true,
          manage_attributes: true, manage_downloads: true,
          manage_users: true, manage_settings: true, manage_admins: true
        };
      }
    } catch(e) {}
  }

  try {
    const Setting = require('../models/Setting');
    const tz = await Setting.get('timezone', 'America/Sao_Paulo');
    res.locals.timezone = tz;
    res.locals.formatDate = (date) => {
      if (!date) return 'N/A';
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleDateString('pt-BR', { timeZone: tz });
      } catch(e) {
        try { const d = new Date(date); if (isNaN(d.getTime())) return 'N/A'; return d.toLocaleDateString('pt-BR'); } catch(e2) { return 'N/A'; }
      }
    };
    res.locals.formatDateTime = (date) => {
      if (!date) return 'N/A';
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleString('pt-BR', { timeZone: tz });
      } catch(e) {
        try { const d = new Date(date); if (isNaN(d.getTime())) return 'N/A'; return d.toLocaleString('pt-BR'); } catch(e2) { return 'N/A'; }
      }
    };
    res.locals.formatTime = (date) => {
      if (!date) return 'N/A';
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'N/A';
        return d.toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
      } catch(e) {
        try { const d = new Date(date); if (isNaN(d.getTime())) return 'N/A'; return d.toLocaleTimeString('pt-BR'); } catch(e2) { return 'N/A'; }
      }
    };
  } catch(e) {
    res.locals.timezone = 'America/Sao_Paulo';
    res.locals.formatDate = (date) => { if (!date) return 'N/A'; try { const d = new Date(date); return isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString('pt-BR'); } catch(e2) { return 'N/A'; } };
    res.locals.formatDateTime = (date) => { if (!date) return 'N/A'; try { const d = new Date(date); return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString('pt-BR'); } catch(e2) { return 'N/A'; } };
    res.locals.formatTime = (date) => { if (!date) return 'N/A'; try { const d = new Date(date); return isNaN(d.getTime()) ? 'N/A' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch(e2) { return 'N/A'; } };
  }
  next();
}

function requireGamePermission(subPermission) {
  return async (req, res, next) => {
    if (!req.session || !req.session.adminId) {
      return res.redirect('/login');
    }
    try {
      const Role = require('../models/Role');
      const role = await Role.findOne({ where: { name: req.session.adminRole } });

      if (req.session.adminRole === 'super_admin') {
        return next();
      }

      if (!role || !role.hasPermission('manage_games')) {
        return res.status(403).render('error', {
          title: 'Acesso Negado',
          message: 'Você não tem permissão para gerenciar games.',
          admin: req.session
        });
      }

      if (subPermission === 'games_delete' && !role.hasPermission('games_delete')) {
        return res.status(403).render('error', {
          title: 'Acesso Negado',
          message: 'Você não tem permissão para excluir games.',
          admin: req.session
        });
      }

      if (subPermission === 'games_edit_others') {
        const Game = require('../models/Game');
        const game = await Game.findByPk(req.params.id);
        if (game && game.created_by && game.created_by !== req.session.adminId && !role.hasPermission('games_edit_others')) {
          return res.status(403).render('error', {
            title: 'Acesso Negado',
            message: 'Você não tem permissão para editar games de outros admins.',
            admin: req.session
          });
        }
      }

      return next();
    } catch (error) {
      console.error('[AUTH] Game permission check error:', error);
      return res.status(403).render('error', {
        title: 'Acesso Negado',
        message: 'Erro ao verificar permissões.',
        admin: req.session
      });
    }
  };
}

module.exports = { requireAuth, requireRole, requirePermission, requireGamePermission, loadAdmin };
