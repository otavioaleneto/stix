const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { ConsoleDownload } = require('../models');
const { Op } = require('sequelize');

function checkConsolePermission(req, res, next) {
  const admin = res.locals.admin;
  if (!admin) return res.redirect('/login');
  const perms = res.locals.permissions || {};
  if (admin.role === 'super_admin' || admin.role === 'admin' || perms.manage_settings) {
    return next();
  }
  return res.status(403).render('error', { title: 'Acesso Negado', message: 'Sem permissão.' });
}

router.get('/', requireAuth, checkConsolePermission, async (req, res) => {
  try {
    const { search, page = 1 } = req.query;
    const allowedLimits = [15, 30, 50];
    const limit = allowedLimits.includes(parseInt(req.query.limit)) ? parseInt(req.query.limit) : 15;
    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
      where.console_id = { [Op.like]: `%${search}%` };
    }

    const { count, rows: consoles } = await ConsoleDownload.findAndCountAll({
      where,
      order: [['last_seen', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    res.render('consoles/index', {
      title: 'Consoles',
      consoles,
      search: search || '',
      currentPage: parseInt(page),
      totalPages,
      totalConsoles: count,
      limit
    });
  } catch (error) {
    console.error('[CONSOLES] Error:', error);
    res.render('consoles/index', {
      title: 'Consoles',
      consoles: [],
      search: '',
      currentPage: 1,
      totalPages: 0,
      totalConsoles: 0,
      limit: 15
    });
  }
});

router.post('/:id/ban', requireAuth, checkConsolePermission, async (req, res) => {
  try {
    const record = await ConsoleDownload.findByPk(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Console not found' });
    }
    record.banned = true;
    await record.save();
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, banned: true });
    }
    res.redirect('/consoles?search=' + encodeURIComponent(req.query.search || '') + '&limit=' + (req.query.limit || 15) + '&page=' + (req.query.page || 1));
  } catch (error) {
    console.error('[CONSOLES] Ban error:', error);
    res.status(500).json({ success: false, error: 'Failed to ban console' });
  }
});

router.post('/:id/unban', requireAuth, checkConsolePermission, async (req, res) => {
  try {
    const record = await ConsoleDownload.findByPk(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, error: 'Console not found' });
    }
    record.banned = false;
    await record.save();
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({ success: true, banned: false });
    }
    res.redirect('/consoles?search=' + encodeURIComponent(req.query.search || '') + '&limit=' + (req.query.limit || 15) + '&page=' + (req.query.page || 1));
  } catch (error) {
    console.error('[CONSOLES] Unban error:', error);
    res.status(500).json({ success: false, error: 'Failed to unban console' });
  }
});

module.exports = router;
