const { FileReport, GameFile, Game } = require('../models');

exports.index = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = [15, 30, 50].includes(parseInt(req.query.limit)) ? parseInt(req.query.limit) : 15;
    const filterType = req.query.file_type || '';
    const offset = (page - 1) * limit;

    const where = {};
    if (filterType) {
      where.file_type = filterType;
    }

    const { count, rows: reports } = await FileReport.findAndCountAll({
      where,
      include: [{
        model: GameFile,
        as: 'gameFile',
        include: [{ model: Game, as: 'game' }]
      }],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit);

    const typeCounts = await FileReport.findAll({
      attributes: [
        'file_type',
        [require('../config/database').fn('COUNT', require('../config/database').col('id')), 'count']
      ],
      group: ['file_type'],
      raw: true
    });

    res.render('reports/index', {
      title: 'Reports',
      reports,
      currentPage: page,
      totalPages,
      limit,
      total: count,
      filterType,
      typeCounts
    });
  } catch (error) {
    console.error('[Reports] Error:', error.message);
    res.render('reports/index', {
      title: 'Reports',
      reports: [],
      currentPage: 1,
      totalPages: 1,
      limit: 15,
      total: 0,
      filterType: '',
      typeCounts: []
    });
  }
};

exports.destroy = async (req, res) => {
  try {
    await FileReport.destroy({ where: { id: req.params.id } });
    res.redirect('/reports');
  } catch (error) {
    console.error('[Reports] Delete error:', error.message);
    res.redirect('/reports');
  }
};
