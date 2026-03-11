const { Attribute } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

exports.index = async (req, res) => {
  try {
    const fileTypes = await Attribute.findAll({
      where: { category: 'file_type' },
      order: [['sort_order', 'ASC'], ['label', 'ASC']]
    });
    const platforms = await Attribute.findAll({
      where: { category: 'platform' },
      order: [['sort_order', 'ASC'], ['label', 'ASC']]
    });
    const categories = await Attribute.findAll({
      where: { category: 'category' },
      order: [['sort_order', 'ASC'], ['label', 'ASC']]
    });

    res.render('attributes/index', {
      title: 'Atributos',
      fileTypes,
      platforms,
      categories,
      error: null,
      success: req.query.success || null
    });
  } catch (error) {
    console.error('[ATTRIBUTES] Index error:', error);
    res.render('attributes/index', {
      title: 'Atributos',
      fileTypes: [],
      platforms: [],
      categories: [],
      error: error.message,
      success: null
    });
  }
};

function generateKey(label) {
  return (label || '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

exports.store = async (req, res) => {
  try {
    const { category, label, sort_order } = req.body;
    let { value } = req.body;
    if (!category || !label) {
      return res.redirect('/attributes?error=missing_fields');
    }

    if (!value || value.trim() === '') {
      value = generateKey(label);
    } else {
      value = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    }

    const existing = await Attribute.findOne({ where: { category, value } });
    if (existing) {
      return res.redirect('/attributes?error=duplicate');
    }

    let finalSortOrder = parseInt(sort_order) || 0;

    if (finalSortOrder === 0) {
      const maxResult = await Attribute.findOne({
        where: { category },
        attributes: [[sequelize.fn('MAX', sequelize.col('sort_order')), 'maxOrder']]
      });
      const maxOrder = maxResult && maxResult.getDataValue('maxOrder');
      finalSortOrder = (maxOrder || 0) + 1;
    } else {
      const duplicateOrder = await Attribute.findOne({
        where: { category, sort_order: finalSortOrder }
      });
      if (duplicateOrder) {
        await Attribute.increment('sort_order', {
          by: 1,
          where: {
            category,
            sort_order: { [Op.gte]: finalSortOrder }
          }
        });
      }
    }

    await Attribute.create({
      category,
      value,
      label: label.trim(),
      sort_order: finalSortOrder
    });

    res.redirect('/attributes?success=created');
  } catch (error) {
    console.error('[ATTRIBUTES] Store error:', error);
    res.redirect('/attributes?error=' + encodeURIComponent(error.message));
  }
};

exports.update = async (req, res) => {
  try {
    const attr = await Attribute.findByPk(req.params.id);
    if (!attr) return res.redirect('/attributes');

    const { label, sort_order, value } = req.body;
    const updateData = {};
    if (label) updateData.label = label.trim();
    if (sort_order !== undefined) {
      let finalSortOrder = parseInt(sort_order) || 0;
      if (finalSortOrder === 0) {
        const maxResult = await Attribute.findOne({
          where: { category: attr.category },
          attributes: [[sequelize.fn('MAX', sequelize.col('sort_order')), 'maxOrder']]
        });
        const maxOrder = maxResult && maxResult.getDataValue('maxOrder');
        finalSortOrder = (maxOrder || 0) + 1;
      } else {
        const duplicateOrder = await Attribute.findOne({
          where: {
            category: attr.category,
            sort_order: finalSortOrder,
            id: { [Op.ne]: attr.id }
          }
        });
        if (duplicateOrder) {
          await Attribute.increment('sort_order', {
            by: 1,
            where: {
              category: attr.category,
              sort_order: { [Op.gte]: finalSortOrder },
              id: { [Op.ne]: attr.id }
            }
          });
        }
      }
      updateData.sort_order = finalSortOrder;
    }
    if (value) updateData.value = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    await attr.update(updateData);
    res.redirect('/attributes?success=updated');
  } catch (error) {
    console.error('[ATTRIBUTES] Update error:', error);
    res.redirect('/attributes?error=' + encodeURIComponent(error.message));
  }
};

exports.storeJson = async (req, res) => {
  try {
    const { category, label } = req.body;
    if (!category || !label) {
      return res.status(400).json({ success: false, message: 'Categoria e nome são obrigatórios' });
    }

    const value = generateKey(label);
    const existing = await Attribute.findOne({ where: { category, value } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Atributo já existe' });
    }

    const maxSort = await Attribute.max('sort_order', { where: { category } });
    const sort_order = (maxSort || 0) + 1;

    const attr = await Attribute.create({
      category,
      value,
      label: label.trim(),
      sort_order
    });

    res.json({ success: true, attribute: { id: attr.id, value: attr.value, label: attr.label } });
  } catch (error) {
    console.error('[ATTRIBUTES] StoreJson error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.destroy = async (req, res) => {
  try {
    const attr = await Attribute.findByPk(req.params.id);
    if (attr) await attr.destroy();
    res.redirect('/attributes?success=deleted');
  } catch (error) {
    console.error('[ATTRIBUTES] Destroy error:', error);
    res.redirect('/attributes?error=' + encodeURIComponent(error.message));
  }
};
