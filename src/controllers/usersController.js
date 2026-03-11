const wordpressService = require('../services/wordpressService');
const { UserProfile } = require('../models');

exports.index = async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const result = await wordpressService.getMembers(forceRefresh);

    const allMembers = result.members || [];

    const wpUserIds = allMembers.map(m => m.id).filter(Boolean);
    let lastSeenMap = {};
    if (wpUserIds.length > 0) {
      const profiles = await UserProfile.findAll({
        where: { wp_user_id: wpUserIds },
        attributes: ['wp_user_id', 'last_seen']
      });
      profiles.forEach(p => {
        lastSeenMap[p.wp_user_id] = p.last_seen;
      });
    }
    allMembers.forEach(m => {
      m.last_seen = lastSeenMap[m.id] || null;
    });
    const allowedLimits = [15, 30, 50];
    const limit = allowedLimits.includes(parseInt(req.query.limit)) ? parseInt(req.query.limit) : 15;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const search = (req.query.search || '').trim();
    const sort = (req.query.sort || '').trim();

    let filtered = allMembers;
    if (search) {
      const s = search.toLowerCase();
      filtered = allMembers.filter(m =>
        (m.name && m.name.toLowerCase().includes(s)) ||
        (m.username && m.username.toLowerCase().includes(s)) ||
        (m.email && m.email.toLowerCase().includes(s))
      );
    }

    if (sort === 'level_asc') {
      filtered.sort((a, b) => (a.level_id || 999) - (b.level_id || 999));
    } else if (sort === 'level_desc') {
      filtered.sort((a, b) => (b.level_id || 0) - (a.level_id || 0));
    } else if (sort === 'name_asc') {
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sort === 'name_desc') {
      filtered.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
    }

    const totalMembers = filtered.length;
    const totalPages = Math.ceil(totalMembers / limit);
    const offset = (page - 1) * limit;
    const paginatedMembers = filtered.slice(offset, offset + limit);

    res.render('users/index', {
      title: 'Usuarios',
      members: paginatedMembers,
      totalMembers,
      totalAll: allMembers.length,
      wpStatus: result.success ? 'connected' : 'disconnected',
      message: result.message || '',
      source: result.source || '',
      currentPage: page,
      totalPages,
      limit,
      search,
      sort
    });
  } catch (error) {
    console.error('[USERS] Index error:', error);
    res.render('users/index', {
      title: 'Usuarios',
      members: [],
      totalMembers: 0,
      totalAll: 0,
      wpStatus: 'error',
      message: error.message,
      source: '',
      currentPage: 1,
      totalPages: 0,
      limit: 15,
      search: '',
      sort: ''
    });
  }
};
