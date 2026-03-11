const { Download, GameFile } = require('../models');
const { Op } = require('sequelize');
const downloadTracker = require('../services/downloadTracker');

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let b = parseFloat(bytes);
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
  return b.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function formatElapsed(seconds) {
  if (!seconds || seconds < 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return h + 'h ' + m + 'm';
  if (m > 0) return m + 'm ' + s + 's';
  return s + 's';
}

function buildDateFilter(dateFrom, dateTo) {
  const where = {};
  if (dateFrom || dateTo) {
    where.started_at = {};
    if (dateFrom) {
      where.started_at[Op.gte] = new Date(dateFrom + 'T00:00:00');
    }
    if (dateTo) {
      const end = new Date(dateTo + 'T23:59:59');
      where.started_at[Op.lte] = end;
    }
  }
  return where;
}

exports.index = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 15, 1), 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const dateFrom = req.query.date_from || '';
    const dateTo = req.query.date_to || '';

    const todayWhereClause = {
      started_at: { [Op.gte]: today, [Op.lt]: tomorrow }
    };

    const allTodayDownloads = await Download.findAll({
      where: todayWhereClause,
      attributes: ['status', 'bytes_transferred']
    });

    const todayTotal = allTodayDownloads.length;
    const todayCompleted = allTodayDownloads.filter(d => d.status === 'completed').length;
    const todayFailed = allTodayDownloads.filter(d => d.status === 'failed').length;
    const todayCancelled = allTodayDownloads.filter(d => d.status === 'cancelled').length;

    const todayBytes = allTodayDownloads
      .filter(d => d.status === 'completed')
      .reduce((sum, d) => sum + (parseInt(d.bytes_transferred) || 0), 0);

    const historyWhere = buildDateFilter(dateFrom, dateTo);

    const { count: historyTotal, rows: historyDownloads } = await Download.findAndCountAll({
      where: historyWhere,
      order: [['started_at', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(historyTotal / limit);
    const activeDownloads = downloadTracker.getActiveDownloads();

    let filteredStats = null;
    if (dateFrom || dateTo) {
      const filteredDownloads = await Download.findAll({
        where: historyWhere,
        attributes: ['status', 'bytes_transferred']
      });
      const filteredTotal = filteredDownloads.length;
      const filteredCompleted = filteredDownloads.filter(d => d.status === 'completed').length;
      const filteredCancelled = filteredDownloads.filter(d => d.status === 'cancelled').length;
      const filteredBytes = filteredDownloads
        .filter(d => d.status === 'completed')
        .reduce((sum, d) => sum + (parseInt(d.bytes_transferred) || 0), 0);
      filteredStats = {
        total: filteredTotal,
        completed: filteredCompleted,
        cancelled: filteredCancelled,
        bytes: filteredBytes
      };
    }

    res.render('downloads/index', {
      title: 'Downloads',
      historyDownloads,
      historyTotal,
      todayTotal,
      todayCompleted,
      todayFailed,
      todayCancelled,
      todayBytes,
      activeDownloads,
      formatBytes,
      formatElapsed,
      currentPage: page,
      totalPages,
      limit,
      dateFrom,
      dateTo,
      filteredStats
    });
  } catch (error) {
    console.error('[DOWNLOADS] Index error:', error);
    res.render('downloads/index', {
      title: 'Downloads',
      historyDownloads: [],
      historyTotal: 0,
      todayTotal: 0,
      todayCompleted: 0,
      todayFailed: 0,
      todayCancelled: 0,
      todayBytes: 0,
      activeDownloads: [],
      formatBytes,
      formatElapsed,
      currentPage: 1,
      totalPages: 0,
      limit: 15,
      dateFrom: '',
      dateTo: '',
      filteredStats: null
    });
  }
};

exports.historyJson = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 15, 1), 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const dateFrom = req.query.date_from || '';
    const dateTo = req.query.date_to || '';

    const historyWhere = buildDateFilter(dateFrom, dateTo);

    const { count, rows } = await Download.findAndCountAll({
      where: historyWhere,
      order: [['started_at', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    let filteredStats = null;
    if (dateFrom || dateTo) {
      const filteredDownloads = await Download.findAll({
        where: historyWhere,
        attributes: ['status', 'bytes_transferred']
      });
      const filteredTotal = filteredDownloads.length;
      const filteredCompleted = filteredDownloads.filter(d => d.status === 'completed').length;
      const filteredBytes = filteredDownloads
        .filter(d => d.status === 'completed')
        .reduce((sum, d) => sum + (parseInt(d.bytes_transferred) || 0), 0);
      filteredStats = {
        total: filteredTotal,
        completed: filteredCompleted,
        bytes: filteredBytes
      };
    }

    res.json({
      success: true,
      downloads: rows.map(dl => ({
        id: dl.id,
        game_title: dl.game_title || '-',
        file_name: dl.file_name,
        bytes_transferred: dl.bytes_transferred,
        status: dl.status,
        client_ip: dl.client_ip || '-',
        user_identifier: dl.user_identifier || '-',
        started_at: dl.started_at
      })),
      total: count,
      currentPage: page,
      totalPages,
      limit,
      filteredStats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.activeJson = async (req, res) => {
  try {
    const activeDownloads = downloadTracker.getActiveDownloads();
    res.json({ success: true, downloads: activeDownloads });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.cancel = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = downloadTracker.cancelDownload(id);
    if (result) {
      await Download.update({ status: 'cancelled', completed_at: new Date() }, { where: { id } });
      res.json({ success: true, message: 'Download cancelado' });
    } else {
      res.json({ success: false, message: 'Download nao encontrado' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
