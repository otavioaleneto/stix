const { UserAchievement, UserProfile, Friendship, GameComment, GameRoom, Notification, StixAchievementDef } = require('../models');
const { Op } = require('sequelize');

const ACHIEVEMENT_CATALOG = {
  first_download: {
    name: 'First Download',
    description: 'Downloaded your first game',
    icon: '🎮',
    check: (profile) => profile.total_downloads >= 1
  },
  downloads_10: {
    name: '10 Downloads',
    description: 'Downloaded 10 games',
    icon: '📦',
    check: (profile) => profile.total_downloads >= 10
  },
  downloads_50: {
    name: '50 Downloads',
    description: 'Downloaded 50 games',
    icon: '🏆',
    check: (profile) => profile.total_downloads >= 50
  },
  downloads_100: {
    name: '100 Downloads',
    description: 'Downloaded 100 games — true collector!',
    icon: '👑',
    check: (profile) => profile.total_downloads >= 100
  },
  gold_member: {
    name: 'Gold Member',
    description: 'Reached Gold membership level',
    icon: '🥇',
    check: (profile) => {
      const name = (profile.level_name || '').toLowerCase();
      return name.includes('gold') || name.includes('ouro');
    }
  },
  vip_member: {
    name: 'VIP Member',
    description: 'Reached VIP membership level',
    icon: '⭐',
    check: (profile) => {
      const name = (profile.level_name || '').toLowerCase();
      return name.includes('vip') || name.includes('platina') || name.includes('platinum');
    }
  },
  first_comment: {
    name: 'First Comment',
    description: 'Left your first comment on a game',
    icon: '💬',
    check: null
  },
  first_room: {
    name: 'Room Creator',
    description: 'Created your first game room',
    icon: '🏠',
    check: null
  },
  social_butterfly_5_friends: {
    name: 'Social Butterfly',
    description: 'Made 5 friends',
    icon: '🦋',
    check: null
  }
};

async function getAchievementDef(key) {
  try {
    const dbDef = await StixAchievementDef.findOne({ where: { key, active: true } });
    if (dbDef) return { name: dbDef.name, description: dbDef.description, icon: dbDef.icon, auto_rule: dbDef.auto_rule };
  } catch (e) {}
  const fallback = ACHIEVEMENT_CATALOG[key];
  if (fallback) return { name: fallback.name, description: fallback.description, icon: fallback.icon };
  return null;
}

async function awardIfNew(userProfileId, key) {
  const def = await getAchievementDef(key);
  if (!def) return null;

  try {
    const existing = await UserAchievement.findOne({
      where: { user_profile_id: userProfileId, achievement_key: key }
    });
    if (existing) return null;

    const achievement = await UserAchievement.create({
      user_profile_id: userProfileId,
      achievement_key: key,
      achievement_name: def.name,
      achievement_description: def.description,
      icon: def.icon,
      unlocked_at: new Date()
    });

    await UserProfile.increment('achievements_count', {
      by: 1,
      where: { id: userProfileId }
    });

    try {
      await Notification.create({
        user_profile_id: userProfileId,
        type: 'achievement',
        title: 'Achievement Unlocked!',
        message: `${def.icon} ${def.name}: ${def.description}`,
        data: { achievement_key: key },
        read: false
      });
    } catch (notifErr) {
      console.error('[Achievements] Notification error:', notifErr.message);
    }

    console.log('[Achievements] Awarded', key, 'to user', userProfileId);
    return achievement;
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') return null;
    console.error('[Achievements] Award error:', err.message);
    return null;
  }
}

function buildCheckFunction(autoRule) {
  if (!autoRule || !autoRule.type) return null;
  switch (autoRule.type) {
    case 'downloads':
      return (profile) => profile.total_downloads >= (autoRule.threshold || 1);
    case 'membership':
      return (profile) => {
        const name = (profile.level_name || '').toLowerCase();
        const level = (autoRule.level || '').toLowerCase();
        return name.includes(level);
      };
    default:
      return null;
  }
}

async function checkAndAward(userProfileId) {
  try {
    const profile = await UserProfile.findByPk(userProfileId);
    if (!profile) return;

    const awarded = [];
    const checked = new Set();

    let dbDefs = [];
    try {
      dbDefs = await StixAchievementDef.findAll({ where: { active: true } });
    } catch (e) {}

    for (const def of dbDefs) {
      checked.add(def.key);
      if (def.auto_rule && def.auto_rule.type) {
        const checkFn = buildCheckFunction(def.auto_rule);
        if (checkFn && checkFn(profile)) {
          const result = await awardIfNew(userProfileId, def.key);
          if (result) awarded.push(def.key);
        }
      }
    }

    for (const [key, def] of Object.entries(ACHIEVEMENT_CATALOG)) {
      if (checked.has(key)) continue;
      if (def.check && def.check(profile)) {
        const result = await awardIfNew(userProfileId, key);
        if (result) awarded.push(key);
      }
    }

    const commentCount = await GameComment.count({
      where: { user_profile_id: userProfileId }
    });
    if (commentCount >= 1) {
      const result = await awardIfNew(userProfileId, 'first_comment');
      if (result) awarded.push('first_comment');
    }

    const roomCount = await GameRoom.count({
      where: { creator_id: userProfileId }
    });
    if (roomCount >= 1) {
      const result = await awardIfNew(userProfileId, 'first_room');
      if (result) awarded.push('first_room');
    }

    const friendCount = await Friendship.count({
      where: {
        status: 'accepted',
        [Op.or]: [
          { requester_id: userProfileId },
          { addressee_id: userProfileId }
        ]
      }
    });
    if (friendCount >= 5) {
      const result = await awardIfNew(userProfileId, 'social_butterfly_5_friends');
      if (result) awarded.push('social_butterfly_5_friends');
    }

    for (const def of dbDefs) {
      if (checked.has(def.key) && def.auto_rule) {
        const rule = def.auto_rule;
        if (rule.type === 'comments' && commentCount >= (rule.threshold || 1)) {
          const result = await awardIfNew(userProfileId, def.key);
          if (result) awarded.push(def.key);
        }
        if (rule.type === 'rooms' && roomCount >= (rule.threshold || 1)) {
          const result = await awardIfNew(userProfileId, def.key);
          if (result) awarded.push(def.key);
        }
        if (rule.type === 'friends' && friendCount >= (rule.threshold || 1)) {
          const result = await awardIfNew(userProfileId, def.key);
          if (result) awarded.push(def.key);
        }
      }
    }

    return awarded;
  } catch (err) {
    console.error('[Achievements] checkAndAward error:', err.message);
    return [];
  }
}

module.exports = {
  ACHIEVEMENT_CATALOG,
  checkAndAward,
  awardIfNew
};
