const axios = require('axios');
const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const { sequelize, UserProfile, Friendship, GameComment, UserAchievement, UserGameStats, Notification, WordPressConfig, Game, GameAchievement } = require('../models');
const { generateToken } = require('../middleware/profileAuth');
const pushService = require('../services/pushService');
const achievementService = require('../services/achievementService');
const geminiService = require('../services/geminiService');

exports.login = async (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({ success: false, error: 'Login and password required' });
    }

    const wpConfig = await WordPressConfig.findOne({ where: { is_active: true } });
    if (!wpConfig) {
      return res.status(503).json({ success: false, error: 'WordPress not configured' });
    }

    const headers = {};
    if (wpConfig.consumer_key && wpConfig.consumer_secret) {
      headers['Authorization'] = `Basic ${Buffer.from(`${wpConfig.consumer_key}:${wpConfig.consumer_secret}`).toString('base64')}`;
    }

    const response = await axios.get(`${wpConfig.site_url}/wp-json/godsend/v1/auth`, {
      headers,
      params: { login, password },
      timeout: 15000
    });

    const data = response.data;
    if (!data.success) {
      return res.status(401).json({ success: false, error: data.error || 'Invalid credentials' });
    }

    let profile = await UserProfile.findOne({ where: { wp_user_id: data.user_id } });
    if (profile) {
      await profile.update({
        username: data.username,
        email: data.email,
        display_name: data.name || data.username,
        level_id: data.level_id,
        level_name: data.level_name || null,
        last_seen: new Date()
      });
    } else {
      profile = await UserProfile.create({
        wp_user_id: data.user_id,
        username: data.username,
        email: data.email,
        display_name: data.name || data.username,
        level_id: data.level_id,
        level_name: data.level_name || null,
        last_seen: new Date()
      });
    }

    const token = generateToken(profile.id, profile.wp_user_id);

    res.json({
      success: true,
      token,
      profile: {
        id: profile.id,
        wp_user_id: profile.wp_user_id,
        username: profile.username,
        email: profile.email,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        level_id: profile.level_id,
        level_name: profile.level_name,
        bio: profile.bio,
        total_downloads: profile.total_downloads,
        total_playtime_minutes: profile.total_playtime_minutes,
        games_completed: profile.games_completed,
        achievements_count: profile.achievements_count,
        last_seen: profile.last_seen,
        friend_code: profile.friend_code,
        primary_xuid: profile.primary_xuid
      }
    });
  } catch (error) {
    console.error('[PROFILE] Login error:', error.message);
    res.status(500).json({ success: false, error: 'Authentication service error' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const profile = await UserProfile.findByPk(req.params.id, {
      attributes: ['id', 'wp_user_id', 'username', 'display_name', 'avatar_url', 'level_id', 'level_name', 'bio', 'total_downloads', 'total_playtime_minutes', 'games_completed', 'achievements_count', 'last_seen', 'created_at', 'friend_code']
    });
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }
    res.json({ success: true, profile });
  } catch (error) {
    console.error('[PROFILE] Get profile error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const profileId = parseInt(req.params.id);
    if (req.userProfileId !== profileId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const { bio, display_name } = req.body;
    const updates = {};
    if (bio !== undefined) updates.bio = bio;
    if (display_name !== undefined) updates.display_name = display_name;

    await UserProfile.update(updates, { where: { id: profileId } });
    const profile = await UserProfile.findByPk(profileId);
    res.json({ success: true, profile });
  } catch (error) {
    console.error('[PROFILE] Update profile error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const profileId = parseInt(req.params.id);
    const profile = await UserProfile.findByPk(profileId);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const gameStats = await UserGameStats.findAll({
      where: { user_profile_id: profileId },
      include: [{ model: Game, as: 'game', attributes: ['id', 'title', 'cover_image', 'title_id'] }],
      order: [['last_played', 'DESC']],
      limit: 20
    });

    const achievements = await UserAchievement.findAll({
      where: { user_profile_id: profileId },
      order: [['unlocked_at', 'DESC']],
      limit: 10
    });

    res.json({
      success: true,
      stats: {
        total_downloads: profile.total_downloads,
        total_playtime_minutes: profile.total_playtime_minutes,
        games_completed: profile.games_completed,
        achievements_count: profile.achievements_count
      },
      game_stats: gameStats,
      recent_achievements: achievements
    });
  } catch (error) {
    console.error('[PROFILE] Get stats error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getFriends = async (req, res) => {
  try {
    const profileId = parseInt(req.params.id);

    const friendships = await Friendship.findAll({
      where: {
        [Op.or]: [
          { requester_id: profileId, status: 'accepted' },
          { addressee_id: profileId, status: 'accepted' }
        ]
      },
      include: [
        { model: UserProfile, as: 'requester', attributes: ['id', 'username', 'display_name', 'avatar_url', 'level_name', 'last_seen'] },
        { model: UserProfile, as: 'addressee', attributes: ['id', 'username', 'display_name', 'avatar_url', 'level_name', 'last_seen'] }
      ]
    });

    const friends = friendships.map(f => {
      const friend = f.requester_id === profileId ? f.addressee : f.requester;
      return { friendship_id: f.id, ...friend.toJSON() };
    });

    const pending = await Friendship.findAll({
      where: { addressee_id: profileId, status: 'pending' },
      include: [
        { model: UserProfile, as: 'requester', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
      ]
    });

    const sent = await Friendship.findAll({
      where: { requester_id: profileId, status: 'pending' },
      include: [
        { model: UserProfile, as: 'addressee', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
      ]
    });

    const sent_requests = sent.map(s => ({ friendship_id: s.id, ...s.addressee.toJSON() }));

    res.json({ success: true, friends, pending_requests: pending, sent_requests });
  } catch (error) {
    console.error('[PROFILE] Get friends error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.sendFriendRequest = async (req, res) => {
  try {
    const requesterId = req.userProfileId;
    const addresseeId = parseInt(req.params.id);

    if (requesterId === addresseeId) {
      return res.status(400).json({ success: false, error: 'Cannot send friend request to yourself' });
    }

    const addressee = await UserProfile.findByPk(addresseeId);
    if (!addressee) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const existing = await Friendship.findOne({
      where: {
        [Op.or]: [
          { requester_id: requesterId, addressee_id: addresseeId },
          { requester_id: addresseeId, addressee_id: requesterId }
        ]
      }
    });

    if (existing) {
      return res.status(409).json({ success: false, error: 'Friend request already exists', status: existing.status });
    }

    const friendship = await Friendship.create({
      requester_id: requesterId,
      addressee_id: addresseeId,
      status: 'pending'
    });

    const notifMsg = `${req.userProfile.display_name || req.userProfile.username} enviou um pedido de amizade.`;
    await Notification.create({
      user_profile_id: addresseeId,
      type: 'friend_request',
      title: 'Pedido de Amizade',
      message: notifMsg,
      data: { friendship_id: friendship.id, requester_id: requesterId }
    });

    pushService.sendPush(addresseeId, 'Pedido de Amizade', notifMsg, { type: 'friend_request', friendship_id: friendship.id });

    res.json({ success: true, friendship });
  } catch (error) {
    console.error('[PROFILE] Send friend request error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.respondFriendRequest = async (req, res) => {
  try {
    const friendshipId = parseInt(req.params.friendshipId);
    const { status } = req.body;

    if (!['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Status must be accepted or rejected' });
    }

    const friendship = await Friendship.findByPk(friendshipId);
    if (!friendship) {
      return res.status(404).json({ success: false, error: 'Friendship not found' });
    }

    if (friendship.addressee_id !== req.userProfileId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await friendship.update({ status });
    res.json({ success: true, friendship });

    if (status === 'accepted') {
      achievementService.checkAndAward(req.userProfileId).catch(function() {});
      achievementService.checkAndAward(friendship.requester_id).catch(function() {});
    }
  } catch (error) {
    console.error('[PROFILE] Respond friend request error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.removeFriend = async (req, res) => {
  try {
    const friendshipId = parseInt(req.params.friendshipId);
    const friendship = await Friendship.findByPk(friendshipId);

    if (!friendship) {
      return res.status(404).json({ success: false, error: 'Friendship not found' });
    }

    if (friendship.requester_id !== req.userProfileId && friendship.addressee_id !== req.userProfileId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await friendship.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('[PROFILE] Remove friend error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getGameComments = async (req, res) => {
  try {
    let gameId = req.params.gameId;
    if (isNaN(gameId)) {
      const cleanId = gameId.replace(/^0x/i, '').toUpperCase();
      const game = await Game.findOne({ where: sequelize.where(sequelize.fn('REPLACE', sequelize.fn('UPPER', sequelize.col('title_id')), '0X', ''), cleanId) });
      if (!game) {
        return res.json({ success: true, comments: [], total: 0, page: 1, pages: 0 });
      }
      gameId = game.id;
    } else {
      gameId = parseInt(gameId);
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows: comments } = await GameComment.findAndCountAll({
      where: { game_id: gameId },
      include: [
        { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      comments,
      total: count,
      page,
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('[PROFILE] Get comments error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.addGameComment = async (req, res) => {
  try {
    let gameId = req.params.gameId;
    const { comment_text, game_title } = req.body;

    if (!comment_text || !comment_text.trim()) {
      return res.status(400).json({ success: false, error: 'Comment text required' });
    }

    let game;
    if (isNaN(gameId)) {
      const cleanId = gameId.replace(/^0x/i, '').toUpperCase();
      game = await Game.findOne({ where: sequelize.where(sequelize.fn('REPLACE', sequelize.fn('UPPER', sequelize.col('title_id')), '0X', ''), cleanId) });
      if (!game && game_title) {
        const slug = Game.generateSlug(game_title);
        game = await Game.create({
          title: game_title,
          slug: slug + '-' + Date.now(),
          title_id: cleanId,
          platform: 'xbox360',
          status: 'standby'
        });
        geminiService.getGameInfo(game_title, cleanId).then(async (result) => {
          if (result.success && result.data) {
            const updates = {};
            if (result.data.description) updates.description = result.data.description;
            if (result.data.publisher) updates.publisher = result.data.publisher;
            if (result.data.release_date) updates.release_date = result.data.release_date;
            if (Object.keys(updates).length > 0) {
              await game.update(updates);
            }
          }
        }).catch(function(err) {
          console.error('[PROFILE] Gemini auto-complete error:', err.message);
        });
      }
      if (!game) {
        return res.status(404).json({ success: false, error: 'Game not found' });
      }
      gameId = game.id;
    } else {
      gameId = parseInt(gameId);
      game = await Game.findByPk(gameId);
      if (!game) {
        return res.status(404).json({ success: false, error: 'Game not found' });
      }
    }

    const comment = await GameComment.create({
      game_id: gameId,
      user_profile_id: req.userProfileId,
      comment_text: comment_text.trim()
    });

    const commentWithUser = await GameComment.findByPk(comment.id, {
      include: [
        { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
      ]
    });

    res.json({ success: true, comment: commentWithUser });

    achievementService.checkAndAward(req.userProfileId).catch(function() {});
  } catch (error) {
    console.error('[PROFILE] Add comment error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteGameComment = async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    const comment = await GameComment.findByPk(commentId);

    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    if (comment.user_profile_id !== req.userProfileId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await comment.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('[PROFILE] Delete comment error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getAchievements = async (req, res) => {
  try {
    const profileId = parseInt(req.params.id);
    const achievements = await UserAchievement.findAll({
      where: { user_profile_id: profileId },
      order: [['unlocked_at', 'DESC']]
    });

    res.json({ success: true, achievements });
  } catch (error) {
    console.error('[PROFILE] Get achievements error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateGameStats = async (req, res) => {
  try {
    const profileId = parseInt(req.params.id);
    if (req.userProfileId !== profileId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const { game_id, title_id, playtime_minutes, times_launched, completed } = req.body;
    if (!game_id) {
      return res.status(400).json({ success: false, error: 'game_id required' });
    }

    let stats = await UserGameStats.findOne({
      where: { user_profile_id: profileId, game_id }
    });

    if (stats) {
      const updates = { last_played: new Date() };
      if (title_id !== undefined) updates.title_id = title_id;
      if (playtime_minutes !== undefined) updates.playtime_minutes = (stats.playtime_minutes || 0) + playtime_minutes;
      if (times_launched !== undefined) updates.times_launched = (stats.times_launched || 0) + times_launched;
      if (completed !== undefined) updates.completed = completed;
      await stats.update(updates);
    } else {
      stats = await UserGameStats.create({
        user_profile_id: profileId,
        game_id,
        title_id: title_id || null,
        playtime_minutes: playtime_minutes || 0,
        last_played: new Date(),
        times_launched: times_launched || 1,
        completed: completed || false
      });
    }

    const totalPlaytime = await UserGameStats.sum('playtime_minutes', { where: { user_profile_id: profileId } }) || 0;
    const completedCount = await UserGameStats.count({ where: { user_profile_id: profileId, completed: true } });
    await UserProfile.update(
      { total_playtime_minutes: totalPlaytime, games_completed: completedCount },
      { where: { id: profileId } }
    );

    res.json({ success: true, stats });
  } catch (error) {
    console.error('[PROFILE] Update game stats error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getGameStats = async (req, res) => {
  try {
    const profileId = parseInt(req.params.id);
    const profile = await UserProfile.findByPk(profileId);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const gameStats = await UserGameStats.findAll({
      where: { user_profile_id: profileId },
      include: [{ model: Game, as: 'game', attributes: ['id', 'title', 'cover_image', 'title_id'] }],
      order: [['last_played', 'DESC']]
    });

    res.json({
      success: true,
      game_stats: gameStats
    });
  } catch (error) {
    console.error('[PROFILE] Get game stats error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const profileId = parseInt(req.params.id);
    if (req.userProfileId !== profileId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows: notifications } = await Notification.findAndCountAll({
      where: { user_profile_id: profileId },
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    const unreadCount = await Notification.count({
      where: { user_profile_id: profileId, read: false }
    });

    res.json({
      success: true,
      notifications,
      unread_count: unreadCount,
      total: count,
      page,
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('[PROFILE] Get notifications error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    const notification = await Notification.findByPk(notificationId);

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    if (notification.user_profile_id !== req.userProfileId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await notification.update({ read: true });
    res.json({ success: true });
  } catch (error) {
    console.error('[PROFILE] Mark notification read error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.setPrimaryXuid = async (req, res) => {
  try {
    const { xuid, gamertag } = req.body;
    if (!xuid) {
      return res.status(400).json({ success: false, error: 'XUID is required' });
    }

    const cleanXuid = xuid.replace(/^0x/i, '').toUpperCase();
    if (cleanXuid.length < 7 || !/^[0-9A-F]+$/.test(cleanXuid)) {
      return res.status(400).json({ success: false, error: 'Invalid XUID' });
    }

    const friendCode = cleanXuid.slice(-7);

    const existing = await UserProfile.findOne({
      where: { friend_code: friendCode, id: { [Op.ne]: req.userProfileId } }
    });
    if (existing) {
      return res.status(409).json({ success: false, error: 'Friend code conflict. Try a different profile.' });
    }

    await req.userProfile.update({
      primary_xuid: cleanXuid,
      friend_code: friendCode
    });

    res.json({ success: true, friend_code: friendCode, primary_xuid: cleanXuid });
  } catch (error) {
    console.error('[PROFILE] Set primary XUID error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.lookupByFriendCode = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code || code.length !== 7 || !/^[0-9A-Fa-f]+$/.test(code)) {
      return res.status(400).json({ success: false, error: 'Friend code must be 7 hex characters' });
    }

    const profile = await UserProfile.findOne({
      where: { friend_code: code.toUpperCase() },
      attributes: ['id', 'username', 'display_name', 'avatar_url', 'level_name', 'friend_code']
    });

    if (!profile) {
      return res.status(404).json({ success: false, error: 'No user found with this friend code' });
    }

    res.json({ success: true, profile });
  } catch (error) {
    console.error('[PROFILE] Lookup friend code error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getUserFavorites = async (req, res) => {
  try {
    const profileId = parseInt(req.params.id);
    const profile = await UserProfile.findByPk(profileId, { attributes: ['id', 'wp_user_id'] });
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    const { GameFavorite, Game } = require('../models');
    const favorites = await GameFavorite.findAll({
      where: { user_id: profile.wp_user_id },
      include: [{
        model: Game,
        as: 'game',
        attributes: ['id', 'title', 'slug', 'title_id', 'platform', 'status', 'cover_image'],
        where: { status: 'active' }
      }],
      order: [['id', 'DESC']]
    });

    res.json({
      success: true,
      favorites: favorites.map(f => ({
        id: f.id,
        game: f.game ? f.game.toJSON() : null
      })).filter(f => f.game)
    });
  } catch (error) {
    console.error('[PROFILE] Get favorites error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

function isAllowedImageUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname;
    const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
    if (blocked.includes(hostname)) return false;
    if (/^169\.254\./.test(hostname)) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function normalizeTitleId(tid) {
  if (!tid) return '';
  return tid.replace(/^0x/i, '').toUpperCase();
}

async function downloadAchievementImage(imageUrl, titleId, achievementId) {
  if (!imageUrl || imageUrl.indexOf('http') !== 0) return null;
  if (!isAllowedImageUrl(imageUrl)) return null;
  try {
    const uploadsDir = path.join(__dirname, '..', 'public', 'uploads', 'achievements');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const ext = '.png';
    const safeTitle = normalizeTitleId(titleId).replace(/[^a-zA-Z0-9]/g, '');
    const safeAch = String(achievementId).replace(/[^a-zA-Z0-9]/g, '');
    const filename = `${safeTitle}_${safeAch}${ext}`;
    const filepath = path.join(uploadsDir, filename);
    if (fs.existsSync(filepath)) {
      return `/uploads/achievements/${filename}`;
    }
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 10000,
      maxRedirects: 2,
      maxContentLength: 5 * 1024 * 1024
    });
    const contentType = (response.headers['content-type'] || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      return null;
    }
    fs.writeFileSync(filepath, response.data);
    return `/uploads/achievements/${filename}`;
  } catch (e) {
    console.log('[HARVEST] Image download failed for', achievementId, ':', e.message);
    return null;
  }
}

exports.harvestAchievements = async (req, res) => {
  try {
    const profileId = parseInt(req.params.id);
    if (req.userProfileId !== profileId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const { achievements } = req.body;
    if (!achievements || !Array.isArray(achievements) || achievements.length === 0) {
      return res.status(400).json({ success: false, error: 'Achievements array required' });
    }

    let added = 0;
    let skipped = 0;

    const rawTitleIds = [...new Set(achievements.map(a => a.title_id).filter(Boolean))];
    const gameMap = {};
    for (const tid of rawTitleIds) {
      const normalizedTid = normalizeTitleId(tid);
      const game = await Game.findOne({
        where: sequelize.where(
          sequelize.fn('UPPER', sequelize.fn('REPLACE', sequelize.col('title_id'), '0x', '')),
          normalizedTid
        )
      });
      if (game) gameMap[normalizedTid] = game.id;
    }

    for (const ach of achievements) {
      if (!ach.title_id || !ach.achievement_id) {
        skipped++;
        continue;
      }

      const nTid = normalizeTitleId(ach.title_id);
      let localImageUrl = null;
      try {
        const [gameAch, gameAchCreated] = await GameAchievement.findOrCreate({
          where: {
            title_id: nTid,
            achievement_id: String(ach.achievement_id)
          },
          defaults: {
            game_id: gameMap[nTid] || null,
            name: ach.name || 'Achievement',
            description: ach.description || '',
            image_url: ach.image_url || null,
            gamerscore: ach.gamerscore || 0
          }
        });

        if (gameAchCreated && ach.image_url) {
          localImageUrl = await downloadAchievementImage(ach.image_url, nTid, String(ach.achievement_id));
          if (localImageUrl) {
            await gameAch.update({ image_url: localImageUrl });
          }
        } else {
          localImageUrl = gameAch.image_url;
          if (!localImageUrl && ach.image_url) {
            localImageUrl = await downloadAchievementImage(ach.image_url, nTid, String(ach.achievement_id));
            if (localImageUrl) await gameAch.update({ image_url: localImageUrl });
          }
          if (!gameAch.game_id && gameMap[nTid]) {
            await gameAch.update({ game_id: gameMap[nTid] });
          }
        }
      } catch (e) {
        console.log('[HARVEST] GameAchievement error:', e.message);
      }

      const achievementKey = `xbox_${ach.title_id}_${ach.achievement_id}`;

      try {
        const [record, created] = await UserAchievement.findOrCreate({
          where: {
            user_profile_id: profileId,
            achievement_key: achievementKey
          },
          defaults: {
            achievement_name: ach.name || 'Achievement',
            achievement_description: ach.description || '',
            icon: localImageUrl || ach.image_url || null,
            unlocked_at: ach.unlocked_at || new Date()
          }
        });

        if (created) {
          added++;
        } else {
          if (localImageUrl && record.icon !== localImageUrl) {
            await record.update({ icon: localImageUrl });
          }
          skipped++;
        }
      } catch (e) {
        skipped++;
      }
    }

    const totalAchievements = await UserAchievement.count({
      where: { user_profile_id: profileId }
    });
    await UserProfile.update(
      { achievements_count: totalAchievements },
      { where: { id: profileId } }
    );

    res.json({
      success: true,
      added,
      skipped,
      total: totalAchievements
    });
  } catch (error) {
    console.error('[PROFILE] Harvest achievements error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getVapidPublicKey = async (req, res) => {
  res.json({ success: true, publicKey: pushService.getVapidPublicKey() });
};

exports.pushSubscribe = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, error: 'Invalid subscription' });
    }

    const result = await pushService.subscribe(req.userProfileId, subscription);
    res.json({ success: result });
  } catch (error) {
    console.error('[PROFILE] Push subscribe error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
