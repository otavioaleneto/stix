const { Op } = require('sequelize');
const { Game, GameFile, WebDAVConfig, WordPressConfig, GameDownloadCount, BlogPost, BlogCategory, GameComment, GameRoom, FileReport, UserProfile, Admin } = require('../models');
const wordpressService = require('../services/wordpressService');
const webdavService = require('../services/webdavService');

exports.index = async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalGames,
      activeGames,
      totalFiles,
      webdavConfig,
      wpConfig,
      downloadsToday,
      downloadsWeek,
      downloadsMonth,
      downloadsYear,
      totalPosts,
      recentPosts,
      totalComments,
      recentComments,
      activeRoomsCount,
      recentRooms,
      totalReports,
      recentReports,
      platformXbox360,
      platformXboxOriginal,
      platformDigital
    ] = await Promise.all([
      Game.count(),
      Game.count({ where: { status: 'active' } }),
      GameFile.count(),
      webdavService.getConfig(),
      wordpressService.getConfig(),
      GameDownloadCount.count({ where: { createdAt: { [Op.gte]: startOfDay } } }),
      GameDownloadCount.count({ where: { createdAt: { [Op.gte]: startOfWeek } } }),
      GameDownloadCount.count({ where: { createdAt: { [Op.gte]: startOfMonth } } }),
      GameDownloadCount.count({ where: { createdAt: { [Op.gte]: startOfYear } } }),
      BlogPost.count(),
      BlogPost.findAll({
        order: [['created_at', 'DESC']],
        limit: 2,
        include: [
          { model: Admin, as: 'author', attributes: ['username'] },
          { model: BlogCategory, as: 'category', attributes: ['name'] }
        ]
      }),
      GameComment.count(),
      GameComment.findAll({
        order: [['createdAt', 'DESC']],
        limit: 5,
        include: [
          { model: Game, as: 'game', attributes: ['title'] },
          { model: UserProfile, as: 'userProfile', attributes: ['display_name'] }
        ]
      }),
      GameRoom.count({ where: { status: { [Op.in]: ['scheduled', 'active'] } } }),
      GameRoom.findAll({
        order: [['createdAt', 'DESC']],
        limit: 3,
        include: [
          { model: Game, as: 'game', attributes: ['title'] },
          { model: UserProfile, as: 'creator', attributes: ['display_name'] }
        ]
      }),
      FileReport.count(),
      FileReport.findAll({
        order: [['createdAt', 'DESC']],
        limit: 5
      }),
      Game.count({ where: { platform: 'xbox360' } }),
      Game.count({ where: { platform: 'xbox_original' } }),
      Game.count({ where: { platform: 'digital' } })
    ]);

    let activeMembers = 0;
    let wpStatus = 'not_configured';
    if (wpConfig && wpConfig.is_active) {
      try {
        const result = await wordpressService.getMembers();
        activeMembers = result.members ? result.members.length : 0;
        wpStatus = result.success ? 'connected' : 'error';
      } catch { wpStatus = 'error'; }
    }

    let webdavStatus = 'not_configured';
    if (webdavConfig) {
      webdavStatus = webdavConfig.is_active ? 'connected' : 'disconnected';
    }

    const recentLimit = parseInt(req.query.limit) || 15;
    const recentPage = parseInt(req.query.page) || 1;
    const recentOffset = (recentPage - 1) * recentLimit;

    const { count: recentTotal, rows: recentGames } = await Game.findAndCountAll({
      order: [['created_at', 'DESC']],
      limit: recentLimit,
      offset: recentOffset,
      include: [{ model: GameFile, as: 'files' }]
    });

    const recentTotalPages = Math.ceil(recentTotal / recentLimit);

    const platformStats = {
      xbox360: platformXbox360,
      xbox_original: platformXboxOriginal,
      digital: platformDigital
    };

    res.render('dashboard', {
      title: 'Dashboard',
      totalGames,
      activeGames,
      totalFiles,
      activeMembers,
      wpStatus,
      webdavStatus,
      recentGames,
      recentTotal,
      recentLimit,
      recentPage,
      recentTotalPages,
      platformStats,
      downloadsToday,
      downloadsWeek,
      downloadsMonth,
      downloadsYear,
      totalPosts,
      recentPosts,
      totalComments,
      recentComments,
      activeRoomsCount,
      recentRooms,
      totalReports,
      recentReports
    });
  } catch (error) {
    console.error('[DASHBOARD] Error:', error);
    res.render('dashboard', {
      title: 'Dashboard',
      totalGames: 0, activeGames: 0, totalFiles: 0, activeMembers: 0,
      wpStatus: 'error', webdavStatus: 'error', recentGames: [],
      recentTotal: 0, recentLimit: 15, recentPage: 1, recentTotalPages: 0,
      platformStats: { xbox360: 0, xbox_original: 0, digital: 0 },
      downloadsToday: 0, downloadsWeek: 0, downloadsMonth: 0, downloadsYear: 0,
      totalPosts: 0, recentPosts: [], totalComments: 0, recentComments: [],
      activeRoomsCount: 0, recentRooms: [], totalReports: 0, recentReports: []
    });
  }
};
