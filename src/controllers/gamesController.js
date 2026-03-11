const { Game, GameFile, Attribute, GameCategory, GameDownloadCount, GameRating } = require('../models');
const { Op, fn, col } = require('sequelize');
const path = require('path');
const fs = require('fs');
const webdavService = require('../services/webdavService');
const geminiService = require('../services/geminiService');

function normalizeTitleId(titleId) {
  if (!titleId || !titleId.trim()) return null;
  return titleId.trim().toUpperCase().replace(/^0X/, '');
}

async function checkDuplicateTitleId(titleId, excludeGameId) {
  if (!titleId) return null;
  const cleanId = normalizeTitleId(titleId);
  if (!cleanId) return null;
  const where = {};
  if (excludeGameId) {
    where.id = { [Op.ne]: excludeGameId };
  }
  const sequelize = require('../config/database');
  const [results] = await sequelize.query(
    `SELECT id, title FROM games WHERE REPLACE(UPPER(title_id), '0X', '') = ? ${excludeGameId ? 'AND id != ?' : ''} LIMIT 1`,
    { replacements: excludeGameId ? [cleanId, excludeGameId] : [cleanId] }
  );
  return results.length > 0 ? results[0] : null;
}

exports.index = async (req, res) => {
  try {
    const { search, platform, page = 1 } = req.query;
    const allowedLimits = [15, 30, 50];
    const limit = allowedLimits.includes(parseInt(req.query.limit)) ? parseInt(req.query.limit) : 15;
    const offset = (page - 1) * limit;
    const where = {};

    if (search) where.title = { [Op.like]: `%${search}%` };
    if (platform) where.platform = platform;

    const { count, rows: games } = await Game.findAndCountAll({
      where,
      include: [{ model: GameFile, as: 'files' }, { model: GameCategory, as: 'categories' }],
      order: [['created_at', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    const totalPages = Math.ceil(count / limit);

    const gameIds = games.map(g => g.id);
    const downloadCountRows = await GameDownloadCount.findAll({
      attributes: ['game_id', [fn('COUNT', col('id')), 'count']],
      where: { game_id: { [Op.in]: gameIds } },
      group: ['game_id'],
      raw: true
    });
    const downloadCountMap = {};
    downloadCountRows.forEach(r => { downloadCountMap[r.game_id] = parseInt(r.count); });

    const ratingRows = await GameRating.findAll({
      attributes: ['game_id', [fn('AVG', col('rating')), 'avg'], [fn('COUNT', col('id')), 'votes']],
      where: { game_id: { [Op.in]: gameIds } },
      group: ['game_id'],
      raw: true
    });
    const ratingMap = {};
    ratingRows.forEach(r => { ratingMap[r.game_id] = { avg: parseFloat(parseFloat(r.avg).toFixed(1)), votes: parseInt(r.votes) }; });

    const platformAttrs = await Attribute.findAll({ where: { category: 'platform' }, order: [['sort_order', 'ASC']] });
    const categoryAttrs = await Attribute.findAll({ where: { category: 'category' }, order: [['sort_order', 'ASC']] });
    const catLabelMap = {};
    categoryAttrs.forEach(c => { catLabelMap[c.value] = c.label; });

    res.render('games/index', {
      title: 'Games',
      games,
      downloadCountMap,
      ratingMap,
      search: search || '',
      platform: platform || '',
      currentPage: parseInt(page),
      totalPages,
      totalGames: count,
      limit,
      platformAttrs,
      catLabelMap,
      import_success: req.query.import_success || null,
      import_errors: req.query.import_errors || null,
      import_error: req.query.import_error || null
    });
  } catch (error) {
    console.error('[GAMES] Index error:', error);
    res.render('games/index', {
      title: 'Games', games: [], search: '', platform: '',
      currentPage: 1, totalPages: 0, totalGames: 0, limit: 15, platformAttrs: []
    });
  }
};

exports.create = async (req, res) => {
  const fileTypes = await Attribute.findAll({ where: { category: 'file_type' }, order: [['sort_order', 'ASC']] });
  const platforms = await Attribute.findAll({ where: { category: 'platform' }, order: [['sort_order', 'ASC']] });
  const categoryAttrs = await Attribute.findAll({ where: { category: 'category' }, order: [['sort_order', 'ASC']] });
  res.render('games/form', { title: 'Novo Game', game: null, files: [], error: null, fileTypes, platforms, categoryAttrs, gameCategories: [] });
};

exports.store = async (req, res) => {
  try {
    const { title, description, publisher, release_date, youtube_trailer_url, platform, status, title_id } = req.body;

    if (title_id) {
      const duplicate = await checkDuplicateTitleId(title_id);
      if (duplicate) {
        const fileTypes = await Attribute.findAll({ where: { category: 'file_type' }, order: [['sort_order', 'ASC']] });
        const platforms = await Attribute.findAll({ where: { category: 'platform' }, order: [['sort_order', 'ASC']] });
        const categoryAttrs = await Attribute.findAll({ where: { category: 'category' }, order: [['sort_order', 'ASC']] });
        return res.render('games/form', {
          title: 'Novo Game', game: req.body, files: [], fileTypes, platforms, categoryAttrs, gameCategories: [],
          error: `Já existe um jogo cadastrado com este Title ID: "${duplicate.title}" (ID: ${duplicate.id})`
        });
      }
    }

    const slug = Game.generateSlug(title);

    let existingSlug = await Game.findOne({ where: { slug } });
    const finalSlug = existingSlug ? slug + '-' + Date.now() : slug;

    const gameData = {
      title, slug: finalSlug, description, publisher, platform: platform || 'xbox360',
      status: status || 'active', youtube_trailer_url,
      release_date: release_date || null,
      title_id: normalizeTitleId(title_id)
    };

    if (req.file) {
      gameData.cover_image = '/uploads/' + req.file.filename;
    } else if (req.body.cover_image_url && req.body.cover_image_url.trim()) {
      gameData.cover_image = req.body.cover_image_url.trim();
    }

    if (req.session && req.session.adminId) {
      gameData.created_by = req.session.adminId;
    }

    const game = await Game.create(gameData);

    if (req.body.categories) {
      const cats = Array.isArray(req.body.categories) ? req.body.categories : [req.body.categories];
      for (const catVal of cats) {
        if (catVal) await GameCategory.create({ game_id: game.id, category_value: catVal });
      }
    }

    if (req.body.file_labels) {
      const labels = Array.isArray(req.body.file_labels) ? req.body.file_labels : [req.body.file_labels];
      const types = Array.isArray(req.body.file_types) ? req.body.file_types : [req.body.file_types];
      const serverPaths = Array.isArray(req.body.file_server_paths) ? req.body.file_server_paths : [req.body.file_server_paths];
      const folderPaths = Array.isArray(req.body.file_folder_paths) ? req.body.file_folder_paths : [req.body.file_folder_paths];
      const fileSizes = req.body.file_sizes ? (Array.isArray(req.body.file_sizes) ? req.body.file_sizes : [req.body.file_sizes]) : [];
      const fileSizeUnits = req.body.file_size_units ? (Array.isArray(req.body.file_size_units) ? req.body.file_size_units : [req.body.file_size_units]) : [];
      const mediaIds = req.body.file_media_ids ? (Array.isArray(req.body.file_media_ids) ? req.body.file_media_ids : [req.body.file_media_ids]) : [];

      for (let i = 0; i < labels.length; i++) {
        if (labels[i] && serverPaths[i]) {
          let sizeBytes = null;
          if (fileSizes[i]) {
            const val = parseFloat(fileSizes[i]);
            const unit = (fileSizeUnits[i] || 'GB').toUpperCase();
            if (!isNaN(val)) {
              if (unit === 'GB') sizeBytes = Math.round(val * 1073741824);
              else if (unit === 'MB') sizeBytes = Math.round(val * 1048576);
              else sizeBytes = Math.round(val * 1024);
            }
          }
          await GameFile.create({
            game_id: game.id,
            label: labels[i],
            file_type: types[i] || 'game',
            server_path: serverPaths[i],
            folder_path: folderPaths[i] || '',
            title_id: title_id || '',
            file_size: sizeBytes,
            media_id: mediaIds[i] || null
          });
        }
      }
    }

    res.redirect('/games');
  } catch (error) {
    console.error('[GAMES] Store error:', error);
    const fileTypes = await Attribute.findAll({ where: { category: 'file_type' }, order: [['sort_order', 'ASC']] });
    const platforms = await Attribute.findAll({ where: { category: 'platform' }, order: [['sort_order', 'ASC']] });
    const categoryAttrs = await Attribute.findAll({ where: { category: 'category' }, order: [['sort_order', 'ASC']] });
    res.render('games/form', {
      title: 'Novo Game', game: req.body, files: [], error: error.message, fileTypes, platforms, categoryAttrs, gameCategories: req.body.categories || []
    });
  }
};

exports.edit = async (req, res) => {
  try {
    const game = await Game.findByPk(req.params.id, {
      include: [{ model: GameFile, as: 'files' }, { model: GameCategory, as: 'categories' }]
    });
    if (!game) return res.redirect('/games');

    const fileTypes = await Attribute.findAll({ where: { category: 'file_type' }, order: [['sort_order', 'ASC']] });
    const platforms = await Attribute.findAll({ where: { category: 'platform' }, order: [['sort_order', 'ASC']] });
    const categoryAttrs = await Attribute.findAll({ where: { category: 'category' }, order: [['sort_order', 'ASC']] });
    const gameCategories = (game.categories || []).map(c => c.category_value);
    res.render('games/form', {
      title: 'Editar Game', game, files: game.files || [], error: null, fileTypes, platforms, categoryAttrs, gameCategories
    });
  } catch (error) {
    console.error('[GAMES] Edit error:', error);
    res.redirect('/games');
  }
};

exports.update = async (req, res) => {
  try {
    const game = await Game.findByPk(req.params.id);
    if (!game) return res.redirect('/games');

    const { title, description, publisher, release_date, youtube_trailer_url, platform, status, title_id } = req.body;

    if (title_id) {
      const duplicate = await checkDuplicateTitleId(title_id, game.id);
      if (duplicate) {
        const fileTypes = await Attribute.findAll({ where: { category: 'file_type' }, order: [['sort_order', 'ASC']] });
        const platforms = await Attribute.findAll({ where: { category: 'platform' }, order: [['sort_order', 'ASC']] });
        const categoryAttrs = await Attribute.findAll({ where: { category: 'category' }, order: [['sort_order', 'ASC']] });
        const gameCategories = (await GameCategory.findAll({ where: { game_id: game.id } })).map(c => c.category_value);
        return res.render('games/form', {
          title: 'Editar Game', game: { ...game.toJSON(), ...req.body }, files: game.files || [], fileTypes, platforms, categoryAttrs, gameCategories,
          error: `Já existe um jogo cadastrado com este Title ID: "${duplicate.title}" (ID: ${duplicate.id})`
        });
      }
    }

    const updateData = {
      title, description, publisher, platform: platform || 'xbox360',
      status: status || 'active', youtube_trailer_url,
      release_date: release_date || null,
      title_id: normalizeTitleId(title_id)
    };

    if (req.file) {
      if (game.cover_image && !game.cover_image.startsWith('http')) {
        const oldPath = path.join(__dirname, '..', 'public', game.cover_image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updateData.cover_image = '/uploads/' + req.file.filename;
    } else if (req.body.cover_image_url && req.body.cover_image_url.trim()) {
      if (game.cover_image && !game.cover_image.startsWith('http')) {
        const oldPath = path.join(__dirname, '..', 'public', game.cover_image);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updateData.cover_image = req.body.cover_image_url.trim();
    }

    await game.update(updateData);

    await GameCategory.destroy({ where: { game_id: game.id } });
    if (req.body.categories) {
      const cats = Array.isArray(req.body.categories) ? req.body.categories : [req.body.categories];
      for (const catVal of cats) {
        if (catVal) await GameCategory.create({ game_id: game.id, category_value: catVal });
      }
    }

    await GameFile.destroy({ where: { game_id: game.id } });

    if (req.body.file_labels) {
      const labels = Array.isArray(req.body.file_labels) ? req.body.file_labels : [req.body.file_labels];
      const types = Array.isArray(req.body.file_types) ? req.body.file_types : [req.body.file_types];
      const serverPaths = Array.isArray(req.body.file_server_paths) ? req.body.file_server_paths : [req.body.file_server_paths];
      const folderPaths = Array.isArray(req.body.file_folder_paths) ? req.body.file_folder_paths : [req.body.file_folder_paths];
      const fileSizes = req.body.file_sizes ? (Array.isArray(req.body.file_sizes) ? req.body.file_sizes : [req.body.file_sizes]) : [];
      const fileSizeUnits = req.body.file_size_units ? (Array.isArray(req.body.file_size_units) ? req.body.file_size_units : [req.body.file_size_units]) : [];
      const mediaIds = req.body.file_media_ids ? (Array.isArray(req.body.file_media_ids) ? req.body.file_media_ids : [req.body.file_media_ids]) : [];

      for (let i = 0; i < labels.length; i++) {
        if (labels[i] && serverPaths[i]) {
          let sizeBytes = null;
          if (fileSizes[i]) {
            const val = parseFloat(fileSizes[i]);
            const unit = (fileSizeUnits[i] || 'GB').toUpperCase();
            if (!isNaN(val)) {
              if (unit === 'GB') sizeBytes = Math.round(val * 1073741824);
              else if (unit === 'MB') sizeBytes = Math.round(val * 1048576);
              else sizeBytes = Math.round(val * 1024);
            }
          }
          await GameFile.create({
            game_id: game.id,
            label: labels[i],
            file_type: types[i] || 'game',
            server_path: serverPaths[i],
            folder_path: folderPaths[i] || '',
            title_id: title_id || '',
            file_size: sizeBytes,
            media_id: mediaIds[i] || null
          });
        }
      }
    }

    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    if (isAjax) {
      return res.json({ success: true, message: 'Game salvo com sucesso!' });
    }
    res.redirect('/games');
  } catch (error) {
    console.error('[GAMES] Update error:', error);
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    if (isAjax) {
      return res.status(500).json({ success: false, message: error.message });
    }
    res.redirect(`/games/${req.params.id}/edit`);
  }
};

exports.show = async (req, res) => {
  try {
    const game = await Game.findByPk(req.params.id, {
      include: [{ model: GameFile, as: 'files' }, { model: GameCategory, as: 'categories' }]
    });
    if (!game) return res.redirect('/games');

    const gameData = game.toJSON();
    gameData.created_at = game.createdAt || gameData.createdAt || gameData.created_at || null;

    const categoryAttrs = await Attribute.findAll({ where: { category: 'category' }, order: [['sort_order', 'ASC']] });
    const catMap = {};
    categoryAttrs.forEach(c => { catMap[c.value] = c.label; });
    gameData.categoryLabels = (gameData.categories || []).map(c => catMap[c.category_value] || c.category_value);

    const downloadCount = await GameDownloadCount.count({ where: { game_id: game.id } });

    const ratingData = await GameRating.findAll({
      attributes: [[fn('AVG', col('rating')), 'avg'], [fn('COUNT', col('id')), 'votes']],
      where: { game_id: game.id },
      raw: true
    });
    const avgRating = ratingData[0] && ratingData[0].avg ? parseFloat(parseFloat(ratingData[0].avg).toFixed(1)) : 0;
    const totalVotes = ratingData[0] && ratingData[0].votes ? parseInt(ratingData[0].votes) : 0;

    const GameComment = require('../models').GameComment;
    const UserProfile = require('../models').UserProfile;
    const comments = await GameComment.findAll({
      where: { game_id: game.id },
      include: [{ model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }],
      order: [['created_at', 'DESC']],
      limit: 50
    });

    res.render('games/show', { title: game.title, game: gameData, downloadCount, avgRating, totalVotes, comments });
  } catch (error) {
    console.error('[GAMES] Show error:', error);
    res.redirect('/games');
  }
};

exports.webdavBrowse = async (req, res) => {
  try {
    const dirPath = req.query.path || '/';
    const contents = await webdavService.listDirectory(dirPath);
    const items = contents.map(item => ({
      name: item.basename || item.filename.split('/').filter(Boolean).pop() || item.filename,
      path: item.filename,
      type: item.type === 'directory' ? 'directory' : 'file',
      size: item.size || 0,
      lastmod: item.lastmod || null
    }));
    items.sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
    res.json({ success: true, path: dirPath, items });
  } catch (error) {
    console.error('[GAMES] WebDAV browse error:', error);
    res.json({ success: false, message: error.message, items: [] });
  }
};

function escapeCsvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

exports.exportCsv = async (req, res) => {
  try {
    const games = await Game.findAll({
      include: [{ model: GameFile, as: 'files' }],
      order: [['created_at', 'DESC']]
    });

    const headers = ['title', 'description', 'publisher', 'release_date', 'platform', 'status', 'title_id', 'cover_image', 'youtube_trailer_url'];
    const rows = [headers.map(escapeCsvField).join(',')];

    for (const game of games) {
      const row = headers.map(h => escapeCsvField(game[h]));
      rows.push(row.join(','));
    }

    const csv = rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="games_export.csv"');
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('[GAMES] Export CSV error:', error);
    res.redirect('/games');
  }
};

exports.csvTemplate = async (req, res) => {
  const headers = ['title', 'description', 'publisher', 'release_date', 'platform', 'status', 'title_id', 'cover_image', 'youtube_trailer_url'];
  const exampleRow = ['Example Game', 'Game description here', 'Publisher Name', '2024-01-15', 'xbox360', 'active', '12345678', 'https://example.com/cover.jpg', 'https://youtube.com/watch?v=example'];
  const csv = headers.join(',') + '\n' + exampleRow.map(escapeCsvField).join(',');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="games_template.csv"');
  res.send('\uFEFF' + csv);
};

exports.importCsv = async (req, res) => {
  try {
    if (!req.file) {
      return res.redirect('/games?import_error=Nenhum arquivo selecionado');
    }

    const content = fs.readFileSync(req.file.path, 'utf-8').replace(/^\uFEFF/, '');
    fs.unlinkSync(req.file.path);

    const lines = content.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      return res.redirect('/games?import_error=CSV vazio ou sem dados');
    }

    const headerLine = parseCsvLine(lines[0]);
    const headerMap = {};
    headerLine.forEach((h, i) => { headerMap[h.toLowerCase().trim()] = i; });

    const requiredFields = ['title'];
    for (const field of requiredFields) {
      if (headerMap[field] === undefined) {
        return res.redirect('/games?import_error=Campo obrigatório ausente: ' + field);
      }
    }

    let imported = 0;
    let errors = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const fields = parseCsvLine(lines[i]);
        const getValue = (name) => {
          const idx = headerMap[name.toLowerCase()];
          return idx !== undefined && idx < fields.length ? fields[idx] : '';
        };

        const title = getValue('title');
        if (!title) continue;

        const csvTitleId = getValue('title_id');
        if (csvTitleId) {
          const duplicate = await checkDuplicateTitleId(csvTitleId);
          if (duplicate) {
            console.log(`[GAMES] Import CSV row ${i} skipped: duplicate title_id "${csvTitleId}" (existing: "${duplicate.title}" ID: ${duplicate.id})`);
            errors++;
            continue;
          }
        }

        const slug = Game.generateSlug(title);
        let existingSlug = await Game.findOne({ where: { slug } });
        const finalSlug = existingSlug ? slug + '-' + Date.now() + '-' + i : slug;

        await Game.create({
          title,
          slug: finalSlug,
          description: getValue('description') || null,
          publisher: getValue('publisher') || null,
          release_date: getValue('release_date') || null,
          platform: getValue('platform') || 'xbox360',
          status: ['inactive', 'standby'].includes(getValue('status')) ? getValue('status') : 'active',
          title_id: normalizeTitleId(csvTitleId),
          cover_image: getValue('cover_image') || null,
          youtube_trailer_url: getValue('youtube_trailer_url') || null,
          created_by: req.session.adminId || null
        });
        imported++;
      } catch (rowError) {
        console.error(`[GAMES] Import CSV row ${i} error:`, rowError.message);
        errors++;
      }
    }

    res.redirect('/games?import_success=' + imported + '&import_errors=' + errors);
  } catch (error) {
    console.error('[GAMES] Import CSV error:', error);
    res.redirect('/games?import_error=' + encodeURIComponent(error.message));
  }
};

exports.destroy = async (req, res) => {
  try {
    const game = await Game.findByPk(req.params.id);
    if (!game) return res.redirect('/games');

    if (game.cover_image && !game.cover_image.startsWith('http')) {
      const coverPath = path.join(__dirname, '..', 'public', game.cover_image);
      if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
    }

    await GameFile.destroy({ where: { game_id: game.id } });
    await game.destroy();

    res.redirect('/games');
  } catch (error) {
    console.error('[GAMES] Destroy error:', error);
    res.redirect('/games');
  }
};

exports.aiComplete = async (req, res) => {
  try {
    const game = await Game.findByPk(req.params.id);
    if (!game) {
      return res.status(404).json({ success: false, message: 'Game not found' });
    }

    const result = await geminiService.getGameInfo(game.title, game.title_id);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error });
    }

    const updates = {};
    if (result.data.description && !game.description) updates.description = result.data.description;
    if (result.data.publisher && !game.publisher) updates.publisher = result.data.publisher;
    if (result.data.release_date && !game.release_date) updates.release_date = result.data.release_date;

    if (Object.keys(updates).length > 0) {
      await game.update(updates);
    }

    res.json({
      success: true,
      message: 'Informações preenchidas com IA!',
      data: result.data,
      updated: updates
    });
  } catch (error) {
    console.error('[GAMES] AI Complete error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const gameId = parseInt(req.params.id);
    const commentId = parseInt(req.params.commentId);
    const GameComment = require('../models').GameComment;

    const comment = await GameComment.findOne({ where: { id: commentId, game_id: gameId } });
    if (comment) {
      await comment.destroy();
    }

    res.redirect('/games/' + gameId);
  } catch (error) {
    console.error('[GAMES] Delete comment error:', error);
    res.redirect('/games/' + req.params.id);
  }
};
