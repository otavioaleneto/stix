const { GameRoom, GameRoomParticipant, GameComment, UserProfile, UserAchievement, Game, Friendship, StixAchievementDef, Notification, GameAchievement } = require('../models');
const { Op } = require('sequelize');

async function listRooms(req, res) {
  try {
    const { search, status, page = 1 } = req.query;
    const limit = 15;
    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { game_title: { [Op.like]: `%${search}%` } }
      ];
    }
    if (status) where.status = status;

    const { count, rows: rooms } = await GameRoom.findAndCountAll({
      where,
      include: [
        { model: UserProfile, as: 'creator', attributes: ['id', 'username', 'display_name'] },
        { model: Game, as: 'game', attributes: ['id', 'title'] },
        { model: GameRoomParticipant, as: 'participants', include: [{ model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name'] }] }
      ],
      order: [['createdAt', 'DESC']],
      distinct: true,
      col: 'id',
      limit, offset
    });

    const totalPages = Math.ceil(count / limit);
    res.render('social/rooms', { title: 'Salas de Jogo', rooms, search: search || '', status: status || '', currentPage: parseInt(page), totalPages, totalRooms: count });
  } catch (err) {
    console.error('[Social] listRooms error:', err);
    res.render('social/rooms', { title: 'Salas de Jogo', rooms: [], search: '', status: '', currentPage: 1, totalPages: 0, totalRooms: 0 });
  }
}

async function editRoom(req, res) {
  try {
    const room = await GameRoom.findByPk(req.params.id, {
      include: [
        { model: UserProfile, as: 'creator', attributes: ['id', 'username', 'display_name'] },
        { model: Game, as: 'game', attributes: ['id', 'title'] },
        { model: GameRoomParticipant, as: 'participants', include: [{ model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }] }
      ]
    });
    if (!room) return res.status(404).render('error', { title: '404', message: 'Sala não encontrada' });
    res.render('social/room-form', { title: 'Editar Sala', room });
  } catch (err) {
    console.error('[Social] editRoom error:', err);
    res.status(500).render('error', { title: 'Erro', message: err.message });
  }
}

async function updateRoom(req, res) {
  try {
    const room = await GameRoom.findByPk(req.params.id);
    if (!room) return res.status(404).render('error', { title: '404', message: 'Sala não encontrada' });
    const { title, game_title, status, max_players, is_public, scheduled_at } = req.body;
    await room.update({
      title: title || room.title,
      game_title: game_title !== undefined ? game_title : room.game_title,
      status: status || room.status,
      max_players: max_players ? parseInt(max_players) : room.max_players,
      is_public: is_public === 'true' || is_public === '1',
      scheduled_at: scheduled_at || room.scheduled_at
    });
    res.redirect('/social/rooms');
  } catch (err) {
    console.error('[Social] updateRoom error:', err);
    res.status(500).render('error', { title: 'Erro', message: err.message });
  }
}

async function deleteRoom(req, res) {
  try {
    const room = await GameRoom.findByPk(req.params.id);
    if (!room) return res.status(404).json({ success: false, error: 'Sala não encontrada' });
    await GameRoomParticipant.destroy({ where: { room_id: room.id } });
    await room.destroy();
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.json({ success: true });
    }
    res.redirect('/social/rooms');
  } catch (err) {
    console.error('[Social] deleteRoom error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function listComments(req, res) {
  try {
    const { search, page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
      where[Op.or] = [
        { comment_text: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: comments } = await GameComment.findAndCountAll({
      where,
      include: [
        { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name'] },
        { model: Game, as: 'game', attributes: ['id', 'title'] }
      ],
      order: [['createdAt', 'DESC']],
      limit, offset
    });

    const totalPages = Math.ceil(count / limit);
    res.render('social/comments', { title: 'Comentários', comments, search: search || '', currentPage: parseInt(page), totalPages, totalComments: count });
  } catch (err) {
    console.error('[Social] listComments error:', err);
    res.render('social/comments', { title: 'Comentários', comments: [], search: '', currentPage: 1, totalPages: 0, totalComments: 0 });
  }
}

async function deleteComment(req, res) {
  try {
    const comment = await GameComment.findByPk(req.params.id);
    if (!comment) return res.status(404).json({ success: false, error: 'Comentário não encontrado' });
    await comment.destroy();
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.json({ success: true });
    }
    res.redirect('/social/comments');
  } catch (err) {
    console.error('[Social] deleteComment error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function listAchievements(req, res) {
  try {
    const defs = await StixAchievementDef.findAll({ order: [['sort_order', 'ASC'], ['id', 'ASC']] });
    const awardedCounts = {};
    for (const def of defs) {
      const count = await UserAchievement.count({ where: { achievement_key: def.key } });
      awardedCounts[def.key] = count;
    }
    res.render('social/achievements', { title: 'Conquistas Stix', achievements: defs, awardedCounts });
  } catch (err) {
    console.error('[Social] listAchievements error:', err);
    res.render('social/achievements', { title: 'Conquistas Stix', achievements: [], awardedCounts: {} });
  }
}

async function createAchievementForm(req, res) {
  res.render('social/achievement-form', { title: 'Nova Conquista', achievement: null });
}

async function storeAchievement(req, res) {
  try {
    const { key, name, description, icon, category, auto_rule_type, auto_rule_threshold, auto_rule_level, active, sort_order } = req.body;
    let auto_rule = null;
    if (auto_rule_type && auto_rule_type !== 'none') {
      auto_rule = { type: auto_rule_type };
      if (auto_rule_type === 'membership') {
        auto_rule.level = auto_rule_level || '';
      } else {
        auto_rule.threshold = parseInt(auto_rule_threshold) || 1;
      }
    }
    await StixAchievementDef.create({
      key, name, description: description || null, icon: icon || '🏆',
      category: category || 'special', auto_rule, active: active !== '0',
      sort_order: parseInt(sort_order) || 0
    });
    res.redirect('/social/achievements');
  } catch (err) {
    console.error('[Social] storeAchievement error:', err);
    res.status(500).render('error', { title: 'Erro', message: err.message });
  }
}

async function editAchievementForm(req, res) {
  try {
    const achievement = await StixAchievementDef.findByPk(req.params.id);
    if (!achievement) return res.status(404).render('error', { title: '404', message: 'Conquista não encontrada' });
    res.render('social/achievement-form', { title: 'Editar Conquista', achievement });
  } catch (err) {
    console.error('[Social] editAchievementForm error:', err);
    res.status(500).render('error', { title: 'Erro', message: err.message });
  }
}

async function updateAchievement(req, res) {
  try {
    const achievement = await StixAchievementDef.findByPk(req.params.id);
    if (!achievement) return res.status(404).render('error', { title: '404', message: 'Conquista não encontrada' });
    const { key, name, description, icon, category, auto_rule_type, auto_rule_threshold, auto_rule_level, active, sort_order } = req.body;
    let auto_rule = null;
    if (auto_rule_type && auto_rule_type !== 'none') {
      auto_rule = { type: auto_rule_type };
      if (auto_rule_type === 'membership') {
        auto_rule.level = auto_rule_level || '';
      } else {
        auto_rule.threshold = parseInt(auto_rule_threshold) || 1;
      }
    }
    await achievement.update({
      key, name, description: description || null, icon: icon || '🏆',
      category: category || 'special', auto_rule, active: active !== '0',
      sort_order: parseInt(sort_order) || 0
    });
    res.redirect('/social/achievements');
  } catch (err) {
    console.error('[Social] updateAchievement error:', err);
    res.status(500).render('error', { title: 'Erro', message: err.message });
  }
}

async function deleteAchievement(req, res) {
  try {
    const achievement = await StixAchievementDef.findByPk(req.params.id);
    if (!achievement) return res.status(404).json({ success: false, error: 'Conquista não encontrada' });
    await achievement.destroy();
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.json({ success: true });
    }
    res.redirect('/social/achievements');
  } catch (err) {
    console.error('[Social] deleteAchievement error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function awardAchievement(req, res) {
  try {
    const { user_profile_id, achievement_key } = req.body;
    const profile = await UserProfile.findByPk(user_profile_id);
    if (!profile) return res.status(404).json({ success: false, error: 'Perfil não encontrado' });
    const def = await StixAchievementDef.findOne({ where: { key: achievement_key } });
    if (!def) return res.status(404).json({ success: false, error: 'Conquista não encontrada' });
    const existing = await UserAchievement.findOne({ where: { user_profile_id, achievement_key } });
    if (existing) return res.status(409).json({ success: false, error: 'Usuário já possui esta conquista' });
    const sequelize = require('../config/database');
    const t = await sequelize.transaction();
    try {
      await UserAchievement.create({
        user_profile_id, achievement_key,
        achievement_name: def.name,
        achievement_description: def.description,
        icon: def.icon,
        unlocked_at: new Date()
      }, { transaction: t });
      await UserProfile.increment('achievements_count', { by: 1, where: { id: user_profile_id }, transaction: t });
      await t.commit();
    } catch (txErr) {
      await t.rollback();
      throw txErr;
    }
    try {
      await Notification.create({
        user_profile_id, type: 'achievement',
        title: 'Conquista Desbloqueada!',
        message: `${def.icon} ${def.name}: ${def.description}`,
        data: { achievement_key }, read: false
      });
    } catch (e) {}
    res.json({ success: true });
  } catch (err) {
    console.error('[Social] awardAchievement error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function listProfiles(req, res) {
  try {
    const { search, page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;
    const where = {};

    if (search) {
      where[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { display_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: profiles } = await UserProfile.findAndCountAll({
      where,
      order: [['last_seen', 'DESC']],
      limit, offset
    });

    const totalPages = Math.ceil(count / limit);
    res.render('social/profiles', { title: 'Perfis de Usuários', profiles, search: search || '', currentPage: parseInt(page), totalPages, totalProfiles: count });
  } catch (err) {
    console.error('[Social] listProfiles error:', err);
    res.render('social/profiles', { title: 'Perfis de Usuários', profiles: [], search: '', currentPage: 1, totalPages: 0, totalProfiles: 0 });
  }
}

async function showProfile(req, res) {
  try {
    const profile = await UserProfile.findByPk(req.params.id, {
      include: [
        { model: UserAchievement, as: 'achievements', separate: true, order: [['unlocked_at', 'DESC']] },
        { model: GameComment, as: 'comments', separate: true, include: [{ model: Game, as: 'game', attributes: ['id', 'title'] }], order: [['createdAt', 'DESC']], limit: 20 },
        { model: GameRoom, as: 'createdRooms', separate: true, include: [{ model: Game, as: 'game', attributes: ['id', 'title'] }], order: [['createdAt', 'DESC']], limit: 10 }
      ]
    });
    if (!profile) return res.status(404).render('error', { title: '404', message: 'Perfil não encontrado' });
    const friendCount = await Friendship.count({
      where: { status: 'accepted', [Op.or]: [{ requester_id: profile.id }, { addressee_id: profile.id }] }
    });
    const allAchievements = await StixAchievementDef.findAll({ where: { active: true }, order: [['sort_order', 'ASC']] });
    res.render('social/profile-detail', { title: 'Perfil: ' + (profile.display_name || profile.username), profile, friendCount, allAchievements });
  } catch (err) {
    console.error('[Social] showProfile error:', err);
    res.status(500).render('error', { title: 'Erro', message: err.message });
  }
}

async function editProfileForm(req, res) {
  try {
    const profile = await UserProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).render('error', { title: '404', message: 'Perfil não encontrado' });
    res.render('social/profile-edit', { title: 'Editar Perfil', profile });
  } catch (err) {
    console.error('[Social] editProfileForm error:', err);
    res.status(500).render('error', { title: 'Erro', message: err.message });
  }
}

async function updateProfile(req, res) {
  try {
    const profile = await UserProfile.findByPk(req.params.id);
    if (!profile) return res.status(404).render('error', { title: '404', message: 'Perfil não encontrado' });
    const { display_name, bio, level_name } = req.body;
    await profile.update({
      display_name: display_name !== undefined ? display_name : profile.display_name,
      bio: bio !== undefined ? bio : profile.bio,
      level_name: level_name !== undefined ? level_name : profile.level_name
    });
    res.redirect('/social/profiles/' + profile.id);
  } catch (err) {
    console.error('[Social] updateProfile error:', err);
    res.status(500).render('error', { title: 'Erro', message: err.message });
  }
}

async function viewRoom(req, res) {
  try {
    const room = await GameRoom.findByPk(req.params.id, {
      include: [
        { model: UserProfile, as: 'creator', attributes: ['id', 'username', 'display_name', 'avatar_url'] },
        { model: Game, as: 'game', attributes: ['id', 'title'] },
        { model: GameRoomParticipant, as: 'participants', include: [{ model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }] }
      ]
    });
    if (!room) return res.status(404).render('error', { title: '404', message: 'Sala não encontrada' });
    const { RoomMessage } = require('../models');
    const messages = await RoomMessage.findAll({
      where: { room_id: room.id },
      include: [{ model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }],
      order: [['createdAt', 'ASC']]
    });
    res.render('social/room-view', { title: 'Detalhes da Sala', room, messages });
  } catch (err) {
    console.error('[Social] viewRoom error:', err);
    res.status(500).render('error', { title: 'Erro', message: err.message });
  }
}

async function listGameAchievements(req, res) {
  try {
    const { game_id, page = 1 } = req.query;
    const limit = 50;
    const offset = (page - 1) * limit;
    const where = {};
    if (game_id) where.game_id = parseInt(game_id);

    const { count, rows } = await GameAchievement.findAndCountAll({
      where,
      include: [{ model: Game, as: 'game', attributes: ['id', 'title', 'title_id', 'cover_image'] }],
      order: [['title_id', 'ASC'], ['name', 'ASC']],
      limit,
      offset
    });

    const games = await Game.findAll({
      attributes: ['id', 'title'],
      order: [['title', 'ASC']]
    });

    const totalPages = Math.ceil(count / limit);
    res.render('social/game-achievements', {
      achievements: rows,
      games,
      selectedGameId: game_id || '',
      currentPage: parseInt(page),
      totalPages,
      total: count
    });
  } catch (err) {
    console.error('[Social] listGameAchievements error:', err);
    res.status(500).render('error', { title: 'Erro', message: err.message });
  }
}

module.exports = {
  listRooms, editRoom, updateRoom, deleteRoom, viewRoom,
  listComments, deleteComment,
  listAchievements, createAchievementForm, storeAchievement, editAchievementForm, updateAchievement, deleteAchievement, awardAchievement,
  listProfiles, showProfile, editProfileForm, updateProfile,
  listGameAchievements
};
