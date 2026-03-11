const { Game, GameFile, Download, Setting, Attribute, GameCategory, ConsoleDownload, GameDownloadCount, GameRating, GameFavorite, FileReport, UserProfile, GameComment } = require('../models');
const webdavService = require('../services/webdavService');
const pydioService = require('../services/pydioService');
const downloadTracker = require('../services/downloadTracker');
const dboxService = require('../services/dboxService');
const achievementService = require('../services/achievementService');
const path = require('path');
const axios = require('axios');
const { WordPressConfig } = require('../models');
const sequelize = require('../config/database');

const _recentAchievementTriggers = new Set();

async function triggerDownloadAchievements(wpUserId, downloadId) {
  if (!wpUserId || wpUserId === '0') return;
  var dedupeKey = wpUserId + ':' + (downloadId || Date.now());
  if (_recentAchievementTriggers.has(dedupeKey)) return;
  _recentAchievementTriggers.add(dedupeKey);
  setTimeout(function() { _recentAchievementTriggers.delete(dedupeKey); }, 60000);
  try {
    const profile = await UserProfile.findOne({ where: { wp_user_id: parseInt(wpUserId) } });
    if (profile) {
      await UserProfile.increment('total_downloads', { by: 1, where: { id: profile.id } });
      await achievementService.checkAndAward(profile.id);
    }
  } catch (err) {
    console.error('[API] Achievement trigger error:', err.message);
  }
}

function safeFileName(name) {
  return (name || 'download').replace(/[^a-zA-Z0-9._\-() ]/g, '_');
}

exports.listCategories = async (req, res) => {
  try {
    const categories = await Attribute.findAll({
      where: { category: 'category' },
      attributes: ['value', 'label'],
      order: [['sort_order', 'ASC']]
    });
    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.listGames = async (req, res) => {
  try {
    const { platform, search, category, page = 1, limit = 50 } = req.query;
    const where = { status: 'active' };
    const { Op } = require('sequelize');

    if (platform) where.platform = platform;
    if (search) where.title = { [Op.like]: `%${search}%` };

    const includeOpts = [];
    if (category) {
      includeOpts.push({
        model: GameCategory,
        as: 'categories',
        where: { category_value: category },
        attributes: []
      });
    }

    const offset = (page - 1) * limit;
    const { count, rows: games } = await Game.findAndCountAll({
      where,
      include: includeOpts,
      attributes: ['id', 'title', 'slug', 'cover_image', 'publisher', 'platform', 'release_date', 'title_id'],
      order: [['title', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    const gameIds = games.map(g => g.id);
    const gameCats = gameIds.length > 0 ? await GameCategory.findAll({ where: { game_id: gameIds } }) : [];
    const catMap = {};
    gameCats.forEach(gc => {
      if (!catMap[gc.game_id]) catMap[gc.game_id] = [];
      catMap[gc.game_id].push(gc.category_value);
    });

    const gamesWithCats = games.map(g => {
      const gj = g.toJSON();
      gj.categories = catMap[g.id] || [];
      return gj;
    });

    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / limit),
      games: gamesWithCats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getGame = async (req, res) => {
  try {
    const game = await Game.findByPk(req.params.id, {
      include: [{ model: GameFile, as: 'files' }, { model: GameCategory, as: 'categories' }]
    });
    if (!game) return res.status(404).json({ success: false, error: 'Game not found' });

    const gj = game.toJSON();
    gj.categories = (gj.categories || []).map(c => c.category_value);

    const downloadCount = await GameDownloadCount.count({ where: { game_id: game.id } });
    gj.download_count = downloadCount;

    const ratingData = await GameRating.findAll({
      where: { game_id: game.id },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('rating')), 'avg_rating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_votes']
      ],
      raw: true
    });
    gj.avg_rating = ratingData[0] ? parseFloat(parseFloat(ratingData[0].avg_rating || 0).toFixed(1)) : 0;
    gj.total_votes = ratingData[0] ? parseInt(ratingData[0].total_votes || 0) : 0;

    res.json({ success: true, game: gj });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getGameFiles = async (req, res) => {
  try {
    const files = await GameFile.findAll({
      where: { game_id: req.params.id },
      order: [['file_type', 'ASC'], ['label', 'ASC']]
    });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const filesWithUrls = files.map(f => ({
      ...f.toJSON(),
      download_url: `${baseUrl}/api/download/${f.id}`
    }));

    res.json({ success: true, files: filesWithUrls });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.downloadFileInfo = async (req, res) => {
  const WEBDAV_TIMEOUT = 15000;
  const WEBDAV_DIR_TIMEOUT = 60000;
  try {
    req.setTimeout(0);
    res.setTimeout(0);

    const file = await GameFile.findByPk(req.params.fileId, {
      include: [{ model: Game, as: 'game' }]
    });
    if (!file) return res.status(404).json({ success: false, error: 'File not found' });

    const client = await webdavService.getClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'WebDAV not configured' });
    }

    const withTimeout = (promise, ms) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('WebDAV timeout')), ms))
    ]);

    let isDirectory = false;
    let fileStat = null;
    try {
      fileStat = await withTimeout(client.stat(file.server_path), WEBDAV_TIMEOUT);
      isDirectory = fileStat.type === 'directory';
    } catch (statErr) {
      console.error('[API] FileInfo stat error:', statErr.message);
      return res.status(500).json({ success: false, error: 'Cannot access path: ' + file.server_path });
    }

    if (!isDirectory) {
      const fileSize = fileStat.size || file.file_size || 0;
      const singleFile = { index: 0, name: path.basename(file.server_path), relative_path: '', size: fileSize };

      const pydioActiveForSingle = await pydioService.isActive();
      if (pydioActiveForSingle) {
        const cdnForSingle = await pydioService.hasCdnProxy();
        const singleDirectUrl = await pydioService.generateDirectUrl(file.server_path, singleFile.name, cdnForSingle ? { useCdn: true } : undefined);
        if (singleDirectUrl) {
          singleFile.direct_url = singleDirectUrl;
          return res.json({
            success: true,
            total_files: 1,
            direct_download: true,
            files: [singleFile]
          });
        }
      }

      return res.json({
        success: true,
        total_files: 1,
        direct_download: false,
        files: [singleFile]
      });
    }

    let contents;
    try {
      contents = await withTimeout(client.getDirectoryContents(file.server_path), WEBDAV_DIR_TIMEOUT);
    } catch (dirErr) {
      console.error('[API] FileInfo directory listing error:', dirErr.message);
      return res.status(500).json({ success: false, error: 'Timeout listing directory: ' + file.server_path });
    }

    const allFiles = [];
    const MAX_DEPTH = 5;

    async function walkDirectory(dirContents, relativePath, depth) {
      if (depth > MAX_DEPTH) return;

      const files = dirContents
        .filter(item => item.type === 'file')
        .sort((a, b) => (a.basename || '').localeCompare(b.basename || ''));

      let dirIndex = 0;
      for (const f of files) {
        allFiles.push({ index: dirIndex++, name: f.basename, relative_path: relativePath, size: f.size || 0 });
      }

      const subDirs = dirContents
        .filter(item => item.type === 'directory')
        .sort((a, b) => (a.basename || '').localeCompare(b.basename || ''));

      for (const dir of subDirs) {
        try {
          const subContents = await withTimeout(client.getDirectoryContents(dir.filename), WEBDAV_DIR_TIMEOUT);
          await walkDirectory(subContents, relativePath + dir.basename + '/', depth + 1);
        } catch (subErr) {
          console.error('[API] FileInfo sub-directory error for', relativePath + dir.basename, ':', subErr.message);
        }
      }
    }

    await walkDirectory(contents, '', 0);

    console.log('[API] FileInfo for', file.server_path, ':', allFiles.length, 'files found');

    const pydioActive = await pydioService.isActive();
    const cdnAvailable = await pydioService.hasCdnProxy();
    let directFiles = null;
    if (pydioActive) {
      directFiles = await pydioService.generateDirectUrls(file.server_path, allFiles, path.basename(file.server_path), cdnAvailable ? { useCdn: true } : undefined);
    }

    res.json({
      success: true,
      total_files: allFiles.length,
      direct_download: !!directFiles,
      files: directFiles || allFiles.map(f => ({
        index: f.index,
        name: f.name,
        relative_path: f.relative_path,
        size: f.size
      }))
    });
  } catch (error) {
    console.error('[API] FileInfo unexpected error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.downloadFile = async (req, res) => {
  try {
    const file = await GameFile.findByPk(req.params.fileId, {
      include: [{ model: Game, as: 'game' }]
    });
    if (!file) return res.status(404).json({ success: false, error: 'File not found' });

    const consoleId = req.query.console_id;
    const wpUserId = req.query.wp_user_id;
    const isGuest = !wpUserId || wpUserId === '0';

    if (consoleId) {
      const bannedConsole = await ConsoleDownload.findOne({ where: { console_id: consoleId, banned: true } });
      if (bannedConsole) {
        return res.status(403).json({ success: false, error: 'Console banned', banned: true });
      }
    }

    if (consoleId && isGuest) {
      const today = new Date().toISOString().split('T')[0];
      let record = await ConsoleDownload.findOne({ where: { console_id: consoleId } });
      if (record) {
        let downloadsToday = record.downloads_today;
        if (record.last_download_date !== today) {
          downloadsToday = 0;
        }
        if (downloadsToday >= 2) {
          return res.status(429).json({ success: false, error: 'Guest download limit reached (2/day)' });
        }
      }
    }

    if (consoleId) {
      try {
        const today = new Date().toISOString().split('T')[0];
        let record = await ConsoleDownload.findOne({ where: { console_id: consoleId } });
        if (!record) {
          await ConsoleDownload.create({
            console_id: consoleId,
            downloads_today: isGuest ? 1 : 0,
            last_download_date: today,
            total_downloads: 1,
            first_seen: new Date(),
            last_seen: new Date()
          });
        } else {
          if (record.last_download_date !== today) {
            record.downloads_today = isGuest ? 1 : 0;
          } else if (isGuest) {
            record.downloads_today += 1;
          }
          record.last_download_date = today;
          record.total_downloads += 1;
          record.last_seen = new Date();
          await record.save();
        }
      } catch (trackErr) {
        console.error('[API] Console tracking error:', trackErr.message);
      }

      try {
        const gameId = file.game_id || (file.game && file.game.id);
        if (gameId) {
          await GameDownloadCount.findOrCreate({
            where: { game_id: gameId, console_id: consoleId },
            defaults: { game_id: gameId, console_id: consoleId }
          });
        }
      } catch (dcErr) {
        console.error('[API] Download count tracking error:', dcErr.message);
      }
    }

    let filePath = file.server_path;
    let fileName = file.label || 'download';
    const fileIndex = parseInt(req.query.fileIndex) || 0;
    const subPath = req.query.subPath || '';

    const client = await webdavService.getClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'WebDAV not configured' });
    }

    let isDirectory = false;
    let fileSize = 0;
    try {
      const stat = await client.stat(filePath);
      isDirectory = stat.type === 'directory';
      if (!isDirectory && stat.size) {
        fileSize = stat.size;
      }
    } catch (statErr) {
      console.error('[API] WebDAV stat error:', statErr.message);
      return res.status(500).json({ success: false, error: 'Cannot access path: ' + filePath });
    }

    if (isDirectory) {
      let targetDir = filePath;
      if (subPath) {
        const safeSub = subPath.replace(/\.\./g, '').replace(/^\/+/, '');
        targetDir = filePath.replace(/\/$/, '') + '/' + safeSub;
      }

      const contents = await client.getDirectoryContents(targetDir);
      const files = contents
        .filter(item => item.type === 'file')
        .sort((a, b) => (a.basename || '').localeCompare(b.basename || ''));

      if (files.length === 0) {
        return res.status(404).json({ success: false, error: 'No files found in directory: ' + targetDir });
      }

      const idx = Math.min(fileIndex, files.length - 1);
      const targetFile = files[idx];
      filePath = targetFile.filename;
      fileName = targetFile.basename || path.basename(filePath);
      fileSize = targetFile.size || 0;
    }

    const pydioActive = await pydioService.isActive();
    if (pydioActive) {
      const acceptHeader = req.headers['accept'] || '';
      const userAgent = req.headers['user-agent'] || '';
      const isApiClient = acceptHeader.includes('application/json') || userAgent.includes('Xenon') || userAgent.includes('GODSend') || req.query.format === 'json' || req.query.wp_user_id || req.query.console_id;
      const isBrowser = !isApiClient;

      const wpUserLabel = req.query.wp_user_id ? 'wp_user_' + req.query.wp_user_id : null;
      const clientIp = wpUserLabel || req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
      const gameTitle = file.game ? file.game.title : '';
      const dlFileName = safeFileName(fileName);

      if (isBrowser) {
        const directUrl = await pydioService.generateDirectUrl(filePath, dlFileName);
        if (directUrl) {
          try {
            await Download.create({
              game_file_id: file.id, game_title: gameTitle, file_name: dlFileName,
              file_size: fileSize || file.file_size || null, status: 'direct',
              client_ip: clientIp, user_identifier: consoleId || (wpUserId && wpUserId !== '0' ? 'wp_user_' + wpUserId : null),
              started_at: new Date(), completed_at: new Date()
            });
          } catch (dbErr) { console.error('[API] Download log error (direct):', dbErr.message); }
          console.log('[API] Browser redirect to Pydio for:', filePath);
          return res.redirect(directUrl);
        }
      }

      if (!isBrowser) {
        const cdnAvailable = await pydioService.hasCdnProxy();
        const warpEnabled = await pydioService.isWarpEnabled();

        if (cdnAvailable) {
          const directUrl = await pydioService.generateDirectUrl(filePath, dlFileName, { useCdn: true });
          if (directUrl) {
            let dlRecord = null;
            try {
              dlRecord = await Download.create({
                game_file_id: file.id, game_title: gameTitle, file_name: dlFileName,
                file_size: fileSize || file.file_size || null, status: 'active',
                client_ip: clientIp, user_identifier: consoleId || (wpUserId && wpUserId !== '0' ? 'wp_user_' + wpUserId : null),
                started_at: new Date()
              });
            } catch (dbErr) { console.error('[API] Download log error (direct):', dbErr.message); }
            console.log('[API] Direct URL for API client (CDN):', filePath);
            return res.json({
              success: true, direct_url: directUrl,
              file_name: dlFileName, file_size: fileSize || file.file_size || 0,
              download_id: dlRecord ? dlRecord.id : null
            });
          }
        }

        if (!cdnAvailable && warpEnabled) {
          const httpsUrl = await pydioService.generateDirectUrlHttps(filePath, dlFileName);
          if (httpsUrl) {
            try {
              console.log('[API] Streaming via WARP for API client:', filePath);
              const warpResponse = await pydioService.streamViaWarp(httpsUrl, res, dlFileName, fileSize || file.file_size || 0);

              let dlRecord = null;
              try {
                dlRecord = await Download.create({
                  game_file_id: file.id, game_title: gameTitle, file_name: dlFileName,
                  file_size: fileSize || file.file_size || null, status: 'streaming',
                  client_ip: clientIp, user_identifier: consoleId || (wpUserId && wpUserId !== '0' ? 'wp_user_' + wpUserId : null),
                  started_at: new Date()
                });
              } catch (dbErr) { console.error('[API] Download log error (warp):', dbErr.message); }

              warpResponse.pipe(res);
              warpResponse.on('end', async () => {
                if (dlRecord) {
                  try { await dlRecord.update({ status: 'completed', completed_at: new Date() }); } catch (e) {}
                }
              });
              req.on('close', async () => {
                if (dlRecord && dlRecord.status !== 'completed') {
                  try { await dlRecord.update({ status: 'cancelled', completed_at: new Date() }); } catch (e) {}
                }
              });
              return;
            } catch (warpErr) {
              console.error('[API] WARP streaming failed, falling back to direct URL:', warpErr.message);
            }
          }
        }

        const directUrl = await pydioService.generateDirectUrl(filePath, dlFileName);
        if (directUrl) {
          try {
            await Download.create({
              game_file_id: file.id, game_title: gameTitle, file_name: dlFileName,
              file_size: fileSize || file.file_size || null, status: 'direct',
              client_ip: clientIp, user_identifier: consoleId || (wpUserId && wpUserId !== '0' ? 'wp_user_' + wpUserId : null),
              started_at: new Date(), completed_at: new Date()
            });
          } catch (dbErr) { console.error('[API] Download log error (direct):', dbErr.message); }
          console.log('[API] Direct URL for API client (fallback):', filePath);
          return res.json({
            success: true, direct_url: directUrl,
            file_name: dlFileName, file_size: fileSize || file.file_size || 0
          });
        }
      }
    }

    const dlFileName = safeFileName(fileName);

    if (fileSize > 0) {
      res.setHeader('Content-Length', fileSize);
    }

    console.log('[API] Downloading file:', filePath, 'as:', dlFileName, 'size:', fileSize);

    req.setTimeout(0);
    res.setTimeout(0);
    if (res.socket) {
      res.socket.setNoDelay(true);
    }

    const stream = await webdavService.getFileStreamDirect(filePath);

    const wpUserLabel = req.query.wp_user_id ? 'wp_user_' + req.query.wp_user_id : null;
    const clientIp = wpUserLabel || req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
    const gameTitle = file.game ? file.game.title : '';

    let dlRecord = null;
    try {
      dlRecord = await Download.create({
        game_file_id: file.id,
        game_title: gameTitle,
        file_name: dlFileName,
        file_size: fileSize || null,
        status: 'active',
        client_ip: clientIp,
        user_identifier: consoleId || (wpUserId && wpUserId !== '0' ? 'wp_user_' + wpUserId : null),
        started_at: new Date()
      });
    } catch (dbErr) {
      console.error('[API] Download log error:', dbErr.message);
    }

    const trackId = dlRecord ? dlRecord.id : Date.now();
    downloadTracker.registerDownload(trackId, {
      gameTitle,
      fileName: dlFileName,
      fileSize,
      clientIp,
      stream,
      response: res
    });

    let transferred = 0;
    let streamFinished = false;
    let lastProgressUpdate = 0;

    stream.on('data', (chunk) => {
      transferred += chunk.length;
      if (transferred - lastProgressUpdate >= 1048576) {
        downloadTracker.updateProgress(trackId, transferred);
        lastProgressUpdate = transferred;
      }
    });

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${dlFileName}"`);
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Content-Encoding', 'identity');
    res.setHeader('Connection', 'keep-alive');

    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('[API] Download stream error:', err);
      streamFinished = true;
      downloadTracker.completeDownload(trackId);
      if (dlRecord) {
        dlRecord.update({ status: 'failed', bytes_transferred: transferred, completed_at: new Date() }).catch(() => {});
      }
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: 'Download failed: ' + err.message });
      } else {
        res.end();
      }
    });

    stream.on('end', () => {
      streamFinished = true;
      downloadTracker.updateProgress(trackId, transferred);
      downloadTracker.completeDownload(trackId);
      if (dlRecord) {
        dlRecord.update({ status: 'completed', bytes_transferred: transferred, completed_at: new Date() }).catch(() => {});
      }
      triggerDownloadAchievements(wpUserId);
    });

    res.on('close', () => {
      if (!streamFinished) {
        const wasCancelled = downloadTracker.isCancelled(trackId);
        downloadTracker.clearCancelled(trackId);
        downloadTracker.completeDownload(trackId);
        if (dlRecord) {
          dlRecord.update({ status: 'cancelled', bytes_transferred: transferred, completed_at: new Date() }).catch(() => {});
        }
      }
      if (stream && typeof stream.destroy === 'function') {
        stream.destroy();
      }
    });
  } catch (error) {
    console.error('[API] Download error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.listDirectoryFiles = async (req, res) => {
  try {
    const dirPath = req.query.path || '/';
    const contents = await webdavService.listDirectory(dirPath);
    res.json({ success: true, contents });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.browseFiles = async (req, res) => {
  try {
    const file = await GameFile.findByPk(req.params.fileId, {
      include: [{ model: Game, as: 'game' }]
    });
    if (!file) return res.status(404).json({ success: false, error: 'File not found' });

    const client = await webdavService.getClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'WebDAV not configured' });
    }

    let isDirectory = false;
    try {
      const stat = await client.stat(file.server_path);
      isDirectory = stat.type === 'directory';
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Cannot access: ' + file.server_path });
    }

    if (!isDirectory) {
      return res.json({
        success: true,
        path: file.server_path,
        is_directory: false,
        files: [{ filename: file.server_path, basename: path.basename(file.server_path), type: 'file' }]
      });
    }

    const contents = await client.getDirectoryContents(file.server_path);
    const fileList = contents.map(item => ({
      filename: item.filename,
      basename: item.basename,
      type: item.type,
      size: item.size || 0,
      lastmod: item.lastmod || ''
    }));

    res.json({
      success: true,
      path: file.server_path,
      is_directory: true,
      files: fileList
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.lookupByTitleIds = async (req, res) => {
  try {
    const { title_ids } = req.query;
    if (!title_ids) {
      return res.json({ success: true, games: {} });
    }

    const ids = title_ids.split(',').map(id => id.trim().toUpperCase()).filter(id => id.length > 0);
    if (ids.length === 0) {
      return res.json({ success: true, games: {} });
    }

    const { Op } = require('sequelize');

    const games = await Game.findAll({
      where: {
        status: 'active',
        title_id: { [Op.in]: ids }
      },
      attributes: ['id', 'title', 'title_id', 'platform'],
      include: [{
        model: GameFile,
        as: 'files',
        attributes: ['id', 'label', 'file_type', 'server_path', 'folder_path', 'title_id', 'file_size']
      }]
    });

    const result = {};
    for (const game of games) {
      const tid = (game.title_id || '').toUpperCase();
      if (tid) {
        result[tid] = {
          id: game.id,
          title: game.title,
          title_id: tid,
          platform: game.platform,
          files: (game.files || []).map(f => ({
            id: f.id,
            label: f.label,
            file_type: f.file_type,
            server_path: f.server_path,
            folder_path: f.folder_path,
            title_id: f.title_id || tid,
            file_size: f.file_size
          }))
        };
      }
    }

    res.json({ success: true, games: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

async function getAccessLevels() {
  try {
    const raw = await Setting.get('access_levels', '[]');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function getDownloadsToday(userId) {
  try {
    const { Op } = require('sequelize');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const count = await Download.count({
      where: {
        client_ip: 'wp_user_' + userId,
        status: 'completed',
        started_at: { [Op.gte]: today }
      }
    });
    return count;
  } catch {
    return 0;
  }
}

exports.authLogin = async (req, res) => {
  try {
    const { login, password } = req.query;
    if (!login || !password) {
      return res.json({ success: false, error: 'Login and password required' });
    }

    const wpConfig = await WordPressConfig.findOne({ where: { is_active: true } });
    if (!wpConfig) {
      return res.json({ success: false, error: 'WordPress not configured' });
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
      return res.json({ success: false, error: data.error || 'Invalid credentials' });
    }

    const levels = await getAccessLevels();
    const levelConfig = levels.find(l => l.level_id === data.level_id);
    const downloadsToday = await getDownloadsToday(data.user_id);

    let allowed = true;
    let dailyLimit = 0;
    let levelName = data.level_name || 'N/A';

    if (levelConfig) {
      allowed = levelConfig.allowed;
      dailyLimit = levelConfig.daily_limit;
      levelName = levelConfig.name || levelName;
    } else if (data.level_id === null && data.status === 'none') {
      allowed = false;
    }

    let expirationDate = data.expiration_date || null;
    let daysRemaining = null;
    if (expirationDate) {
      const expDate = new Date(expirationDate);
      const now = new Date();
      const diffMs = expDate.getTime() - now.getTime();
      daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    res.json({
      success: true,
      user_id: data.user_id,
      username: data.username,
      email: data.email,
      name: data.name,
      level_id: data.level_id,
      level_name: levelName,
      status: data.status,
      allowed: allowed,
      daily_limit: dailyLimit,
      downloads_today: downloadsToday,
      downloads_remaining: dailyLimit > 0 ? Math.max(0, dailyLimit - downloadsToday) : -1,
      expiration_date: expirationDate,
      days_remaining: daysRemaining
    });
  } catch (error) {
    console.error('[API] Auth login error:', error.message);
    res.json({ success: false, error: 'Authentication service error' });
  }
};

exports.authCheck = async (req, res) => {
  try {
    const { user_id, level_id } = req.query;
    if (!user_id) {
      return res.json({ success: false, error: 'user_id required' });
    }

    const uid = parseInt(user_id);
    const lid = level_id ? parseInt(level_id) : null;
    const levels = await getAccessLevels();
    const levelConfig = lid ? levels.find(l => l.level_id === lid) : null;
    const downloadsToday = await getDownloadsToday(uid);

    let allowed = true;
    let dailyLimit = 0;

    if (levelConfig) {
      allowed = levelConfig.allowed;
      dailyLimit = levelConfig.daily_limit;
    } else if (!lid) {
      allowed = false;
    }

    let canDownload = allowed;
    if (allowed && dailyLimit > 0 && downloadsToday >= dailyLimit) {
      canDownload = false;
    }

    res.json({
      success: true,
      allowed: allowed,
      can_download: canDownload,
      daily_limit: dailyLimit,
      downloads_today: downloadsToday,
      downloads_remaining: dailyLimit > 0 ? Math.max(0, dailyLimit - downloadsToday) : -1
    });
  } catch (error) {
    console.error('[API] Auth check error:', error.message);
    res.json({ success: false, error: error.message });
  }
};

exports.registerConsole = async (req, res) => {
  try {
    const { console_id } = req.query;
    if (!console_id || console_id === '') {
      return res.json({ success: true });
    }

    let record = await ConsoleDownload.findOne({ where: { console_id } });
    if (!record) {
      await ConsoleDownload.create({
        console_id,
        downloads_today: 0,
        last_download_date: null,
        total_downloads: 0,
        first_seen: new Date(),
        last_seen: new Date()
      });
      return res.json({ success: true, banned: false });
    } else {
      record.last_seen = new Date();
      await record.save();
      if (record.banned) {
        return res.json({ success: false, banned: true });
      }
    }

    res.json({ success: true, banned: false });
  } catch (error) {
    console.error('[API] Register console error:', error.message);
    res.json({ success: true });
  }
};

exports.guestCheck = async (req, res) => {
  try {
    const { console_id } = req.query;
    if (!console_id) {
      return res.json({ success: false, error: 'console_id required' });
    }

    const today = new Date().toISOString().split('T')[0];
    let record = await ConsoleDownload.findOne({ where: { console_id } });

    if (!record) {
      return res.json({
        success: true,
        can_download: true,
        downloads_today: 0,
        daily_limit: 2,
        downloads_remaining: 2,
        banned: false
      });
    }

    if (record.banned) {
      return res.json({
        success: false,
        can_download: false,
        banned: true
      });
    }

    let downloadsToday = record.downloads_today;
    if (record.last_download_date !== today) {
      downloadsToday = 0;
    }

    res.json({
      success: true,
      can_download: downloadsToday < 2,
      downloads_today: downloadsToday,
      daily_limit: 2,
      downloads_remaining: Math.max(0, 2 - downloadsToday),
      banned: false
    });
  } catch (error) {
    console.error('[API] Guest check error:', error.message);
    res.json({ success: false, error: error.message });
  }
};

exports.guestDownloadTrack = async (req, res) => {
  try {
    const { console_id } = req.query;
    if (!console_id) {
      return res.json({ success: true });
    }

    const today = new Date().toISOString().split('T')[0];
    let record = await ConsoleDownload.findOne({ where: { console_id } });

    if (!record) {
      record = await ConsoleDownload.create({
        console_id,
        downloads_today: 1,
        last_download_date: today,
        total_downloads: 1,
        first_seen: new Date(),
        last_seen: new Date()
      });
    } else {
      if (record.last_download_date !== today) {
        record.downloads_today = 1;
      } else {
        record.downloads_today += 1;
      }
      record.last_download_date = today;
      record.total_downloads += 1;
      record.last_seen = new Date();
      await record.save();
    }

    res.json({ success: true, downloads_today: record.downloads_today });
  } catch (error) {
    console.error('[API] Guest download track error:', error.message);
    res.json({ success: true });
  }
};

exports.rateGame = async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const rating = parseInt(req.query.rating);
    const userId = req.query.user_id;
    const consoleId = req.query.console_id;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be 1-5' });
    }

    const userIdentifier = userId && userId !== '0' ? 'user_' + userId : (consoleId ? 'console_' + consoleId : null);
    if (!userIdentifier) {
      return res.status(400).json({ success: false, error: 'user_id or console_id required' });
    }

    const game = await Game.findByPk(gameId);
    if (!game) return res.status(404).json({ success: false, error: 'Game not found' });

    const [ratingRecord, created] = await GameRating.findOrCreate({
      where: { game_id: gameId, user_identifier: userIdentifier },
      defaults: { game_id: gameId, user_identifier: userIdentifier, rating }
    });

    if (!created) {
      ratingRecord.rating = rating;
      await ratingRecord.save();
    }

    const ratingData = await GameRating.findAll({
      where: { game_id: gameId },
      attributes: [
        [sequelize.fn('AVG', sequelize.col('rating')), 'avg_rating'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_votes']
      ],
      raw: true
    });

    res.json({
      success: true,
      avg_rating: parseFloat(parseFloat(ratingData[0].avg_rating || 0).toFixed(1)),
      total_votes: parseInt(ratingData[0].total_votes || 0)
    });
  } catch (error) {
    console.error('[API] Rate game error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.addFavorite = async (req, res) => {
  try {
    const gameId = parseInt(req.query.game_id);
    const userId = parseInt(req.query.user_id);
    if (!gameId || !userId) {
      return res.status(400).json({ success: false, error: 'game_id and user_id required' });
    }

    await GameFavorite.findOrCreate({
      where: { game_id: gameId, user_id: userId },
      defaults: { game_id: gameId, user_id: userId }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Add favorite error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    const gameId = parseInt(req.query.game_id);
    const userId = parseInt(req.query.user_id);
    if (!gameId || !userId) {
      return res.status(400).json({ success: false, error: 'game_id and user_id required' });
    }

    await GameFavorite.destroy({ where: { game_id: gameId, user_id: userId } });
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Remove favorite error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.listFavorites = async (req, res) => {
  try {
    const userId = parseInt(req.query.user_id);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'user_id required' });
    }

    const favorites = await GameFavorite.findAll({
      where: { user_id: userId },
      include: [{
        model: Game,
        as: 'game',
        include: [{ model: GameFile, as: 'files' }, { model: GameCategory, as: 'categories' }]
      }]
    });

    const games = favorites
      .filter(f => f.game)
      .map(f => {
        const gj = f.game.toJSON();
        gj.categories = (gj.categories || []).map(c => c.category_value);
        return gj;
      });

    res.json({ success: true, games, total: games.length });
  } catch (error) {
    console.error('[API] List favorites error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.checkFavorite = async (req, res) => {
  try {
    const gameId = parseInt(req.query.game_id);
    const userId = parseInt(req.query.user_id);
    if (!gameId || !userId) {
      return res.json({ success: true, is_favorite: false });
    }

    const exists = await GameFavorite.findOne({ where: { game_id: gameId, user_id: userId } });
    res.json({ success: true, is_favorite: !!exists });
  } catch (error) {
    res.json({ success: true, is_favorite: false });
  }
};

exports.reportFile = async (req, res) => {
  try {
    const fileId = parseInt(req.query.file_id);
    const reportType = req.query.type;
    const consoleId = req.query.console_id || null;
    const userId = req.query.user_id ? parseInt(req.query.user_id) : null;

    if (!fileId || !reportType) {
      return res.status(400).json({ success: false, error: 'file_id and type required' });
    }

    if (!['wrong', 'corrupted'].includes(reportType)) {
      return res.status(400).json({ success: false, error: 'type must be wrong or corrupted' });
    }

    const file = await GameFile.findByPk(fileId, {
      include: [{ model: Game, as: 'game' }]
    });
    if (!file) return res.status(404).json({ success: false, error: 'File not found' });

    await FileReport.create({
      game_file_id: fileId,
      game_title: file.game ? file.game.title : null,
      file_name: file.label,
      file_type: file.file_type,
      report_type: reportType,
      console_id: consoleId,
      user_id: userId
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[API] Report file error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getGameByTitleId = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  try {
    const { titleId } = req.params;
    if (!titleId) return res.status(400).json({ success: false, error: 'titleId required' });
    const cleanId = titleId.replace(/^0x/i, '').toUpperCase();
    const { Op } = require('sequelize');
    const game = await Game.findOne({
      where: {
        title_id: { [Op.in]: [cleanId, cleanId.toLowerCase(), '0x' + cleanId, '0x' + cleanId.toLowerCase()] }
      },
      attributes: ['id', 'title', 'slug', 'description', 'publisher', 'release_date', 'title_id', 'platform', 'status', 'youtube_trailer_url']
    });
    if (!game) return res.json({ success: true, game: null });
    res.json({ success: true, game: game.toJSON() });
  } catch (error) {
    console.error('[API] getGameByTitleId error:', error.message);
    res.json({ success: true, game: null });
  }
};

exports.dboxDescription = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  try {
    const { titleId } = req.params;
    if (!titleId) return res.status(400).json({ success: false, error: 'titleId required' });
    const cleanId = titleId.replace(/^0x/i, '');
    if (!/^[0-9A-Fa-f]{1,8}$/.test(cleanId)) return res.status(400).json({ success: false, error: 'Invalid titleId format' });
    const data = await dboxService.getDescription(titleId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[API] DBox description error:', error.message);
    res.json({ success: true, data: null });
  }
};

exports.downloadReport = async (req, res) => {
  try {
    const { file_id, status, bytes, speed, total_size, file_name, game_title, console_id, download_id } = req.query;
    if (!file_id || !status) {
      return res.json({ success: false, error: 'file_id and status required' });
    }

    const validStatuses = ['started', 'progress', 'completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.json({ success: false, error: 'Invalid status' });
    }

    const trackerId = `ext_${file_id}_${console_id || 'unknown'}`;
    const bytesNum = parseInt(bytes) || 0;
    const speedNum = parseInt(speed) || 0;
    const totalSizeNum = parseInt(total_size) || 0;
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
                  || req.headers['cf-connecting-ip']
                  || req.connection?.remoteAddress || '';

    const dlWhereClause = download_id
      ? { id: parseInt(download_id), game_file_id: parseInt(file_id) }
      : null;

    if (status === 'started') {
      downloadTracker.registerDownload(trackerId, {
        gameTitle: game_title || '',
        fileName: file_name || '',
        fileSize: totalSizeNum,
        clientIp: clientIp,
        consoleId: console_id || '',
        external: true,
        dbDownloadId: download_id ? parseInt(download_id) : null
      });

      if (dlWhereClause) {
        try {
          await Download.update(
            { status: 'active', started_at: new Date() },
            { where: dlWhereClause }
          );
        } catch (e) {}
      }
    } else if (status === 'progress') {
      const existing = downloadTracker.findByFileAndConsole(file_id, console_id || 'unknown');
      if (existing) {
        downloadTracker.updateProgress(trackerId, bytesNum);
      } else {
        downloadTracker.registerDownload(trackerId, {
          gameTitle: game_title || '',
          fileName: file_name || '',
          fileSize: totalSizeNum,
          clientIp: clientIp,
          consoleId: console_id || '',
          external: true,
          dbDownloadId: download_id ? parseInt(download_id) : null
        });
        downloadTracker.updateProgress(trackerId, bytesNum);
      }
    } else if (status === 'completed') {
      downloadTracker.completeDownload(trackerId);

      if (dlWhereClause) {
        try {
          await Download.update(
            { status: 'completed', completed_at: new Date(), bytes_transferred: bytesNum || null },
            { where: dlWhereClause }
          );
        } catch (e) {}
      } else {
        try {
          const recent = await Download.findOne({
            where: { game_file_id: parseInt(file_id), status: 'active' },
            order: [['created_at', 'DESC']]
          });
          if (recent) {
            await recent.update({ status: 'completed', completed_at: new Date(), bytes_transferred: bytesNum || null });
          }
        } catch (e) {}
      }

      const reportWpUserId = req.query.wp_user_id;
      triggerDownloadAchievements(reportWpUserId);
    } else if (status === 'failed' || status === 'cancelled') {
      downloadTracker.completeDownload(trackerId);

      if (dlWhereClause) {
        try {
          await Download.update(
            { status: status, completed_at: new Date() },
            { where: dlWhereClause }
          );
        } catch (e) {}
      } else {
        try {
          const recent = await Download.findOne({
            where: { game_file_id: parseInt(file_id), status: 'active' },
            order: [['created_at', 'DESC']]
          });
          if (recent) {
            await recent.update({ status: status, completed_at: new Date() });
          }
        } catch (e) {}
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('[API] Download report error:', error.message);
    return res.json({ success: false, error: error.message });
  }
};

async function findGameByTitleId(titleId) {
  if (!titleId) return null;
  const cleanId = titleId.replace(/^0x/i, '').toUpperCase();
  const { Op } = require('sequelize');
  return Game.findOne({
    where: {
      title_id: { [Op.in]: [cleanId, cleanId.toLowerCase(), '0x' + cleanId, '0x' + cleanId.toLowerCase()] }
    }
  });
}

exports.getGameComments = async (req, res) => {
  try {
    const { titleId } = req.params;
    const game = await findGameByTitleId(titleId);
    if (!game) return res.status(404).json({ success: false, error: 'Game not found' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows: comments } = await GameComment.findAndCountAll({
      where: { game_id: game.id },
      include: [
        { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    res.json({ success: true, comments, total: count, page, pages: Math.ceil(count / limit) });
  } catch (err) {
    console.error('[API] getGameComments error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.addGameComment = async (req, res) => {
  try {
    const { titleId } = req.params;
    const game = await findGameByTitleId(titleId);
    if (!game) return res.status(404).json({ success: false, error: 'Game not found' });

    const { comment_text } = req.body;
    if (!comment_text || !comment_text.trim()) {
      return res.status(400).json({ success: false, error: 'Comment text required' });
    }

    const comment = await GameComment.create({
      game_id: game.id,
      user_profile_id: req.userProfileId,
      comment_text: comment_text.trim()
    });

    const commentWithUser = await GameComment.findByPk(comment.id, {
      include: [
        { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
      ]
    });

    res.json({ success: true, comment: commentWithUser });
  } catch (err) {
    console.error('[API] addGameComment error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.deleteGameComment = async (req, res) => {
  try {
    const commentId = parseInt(req.params.commentId);
    const comment = await GameComment.findByPk(commentId);

    if (!comment) return res.status(404).json({ success: false, error: 'Comment not found' });
    if (comment.user_profile_id !== req.userProfileId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await comment.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('[API] deleteGameComment error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.dboxDescriptionBatch = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  try {
    const ids = (req.query.title_ids || '').split(',').filter(Boolean).slice(0, 50);
    if (!ids.length) return res.status(400).json({ success: false, error: 'title_ids required' });
    const data = await dboxService.getDescriptionBatch(ids);
    res.json({ success: true, data });
  } catch (error) {
    console.error('[API] DBox batch description error:', error.message);
    res.json({ success: true, data: {} });
  }
};
