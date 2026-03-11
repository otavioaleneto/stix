const { Setting } = require('../models');
const wordpressService = require('../services/wordpressService');

async function getAccessLevels() {
  const raw = await Setting.get('access_levels', '[]');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function getLevelConfig(levelId) {
  const levels = await getAccessLevels();
  return levels.find(l => l.level_id === levelId) || null;
}

exports.index = async (req, res) => {
  try {
    const levels = await getAccessLevels();

    let wpLevels = [];
    const userCountByLevel = {};
    try {
      const result = await wordpressService.getMembers(false);
      if (result.success && result.members) {
        const levelMap = {};
        result.members.forEach(m => {
          if (m.level_id) {
            if (!levelMap[m.level_id]) {
              levelMap[m.level_id] = m.membership_level || ('Level ' + m.level_id);
            }
            const lid = parseInt(m.level_id);
            userCountByLevel[lid] = (userCountByLevel[lid] || 0) + 1;
          }
        });
        wpLevels = Object.entries(levelMap).map(([id, name]) => ({
          level_id: parseInt(id),
          name: name
        })).sort((a, b) => a.level_id - b.level_id);
      }
    } catch (e) {
      console.error('[ACCESS] Failed to fetch WP levels:', e.message);
    }

    res.render('access/index', {
      title: 'Acessos',
      levels,
      wpLevels,
      userCountByLevel,
      success: req.query.success === '1'
    });
  } catch (error) {
    console.error('[ACCESS] Index error:', error);
    res.render('access/index', {
      title: 'Acessos',
      levels: [],
      wpLevels: [],
      userCountByLevel: {},
      success: false
    });
  }
};

exports.save = async (req, res) => {
  try {
    const { levels } = req.body;
    let parsed = [];

    if (levels && Array.isArray(levels)) {
      parsed = levels.map(l => ({
        level_id: parseInt(l.level_id) || 0,
        name: (l.name || '').trim(),
        allowed: l.allowed === 'true' || l.allowed === true || l.allowed === '1',
        daily_limit: Math.max(0, parseInt(l.daily_limit) || 0)
      })).filter(l => l.level_id > 0 && l.name);
    }

    await Setting.set('access_levels', JSON.stringify(parsed));
    res.redirect('/access?success=1');
  } catch (error) {
    console.error('[ACCESS] Save error:', error);
    res.redirect('/access');
  }
};

exports.addLevel = async (req, res) => {
  try {
    const { level_id, name, allowed, daily_limit } = req.body;
    const levels = await getAccessLevels();

    const lid = parseInt(level_id) || 0;
    if (lid <= 0 || !name) {
      return res.redirect('/access');
    }

    const existing = levels.findIndex(l => l.level_id === lid);
    const entry = {
      level_id: lid,
      name: (name || '').trim(),
      allowed: allowed === 'true' || allowed === true || allowed === '1',
      daily_limit: Math.max(0, parseInt(daily_limit) || 0)
    };

    if (existing >= 0) {
      levels[existing] = entry;
    } else {
      levels.push(entry);
    }

    levels.sort((a, b) => a.level_id - b.level_id);
    await Setting.set('access_levels', JSON.stringify(levels));
    res.redirect('/access?success=1');
  } catch (error) {
    console.error('[ACCESS] Add level error:', error);
    res.redirect('/access');
  }
};

exports.deleteLevel = async (req, res) => {
  try {
    const levelId = parseInt(req.params.levelId);
    const levels = await getAccessLevels();
    const filtered = levels.filter(l => l.level_id !== levelId);
    await Setting.set('access_levels', JSON.stringify(filtered));
    res.redirect('/access?success=1');
  } catch (error) {
    console.error('[ACCESS] Delete level error:', error);
    res.redirect('/access');
  }
};

exports.getAccessLevels = getAccessLevels;
exports.getLevelConfig = getLevelConfig;
