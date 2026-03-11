const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { Setting } = require('../models');
const sequelize = require('../config/database');

router.get('/', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    const currentVersion = req.app.locals.CMS_VERSION || '1.0.0';
    let dbVersion = '1.0.0';
    try {
      const setting = await Setting.findOne({ where: { key: 'cms_version' } });
      if (setting) dbVersion = setting.value;
    } catch (e) {}

    const needsUpdate = dbVersion !== currentVersion;

    res.render('update', {
      title: 'Atualizar Sistema',
      currentVersion,
      dbVersion,
      needsUpdate,
      updateSuccess: req.query.success === '1',
      updateError: req.query.error || null
    });
  } catch (error) {
    console.error('[UPDATE] Error:', error);
    res.render('update', {
      title: 'Atualizar Sistema',
      currentVersion: req.app.locals.CMS_VERSION || '1.0.0',
      dbVersion: 'desconhecida',
      needsUpdate: true,
      updateSuccess: false,
      updateError: error.message
    });
  }
});

router.post('/run', requireAuth, requireRole('super_admin'), async (req, res) => {
  try {
    console.log('[UPDATE] Starting database update...');

    const qi = sequelize.getQueryInterface();
    const existingTables = await qi.showAllTables();
    const existingSet = new Set(existingTables.map(t => t.toLowerCase()));

    const models = sequelize.models;
    const skipTables = ['sessions'];
    let created = 0;
    let altered = 0;
    const errors = [];

    for (const modelName in models) {
      const model = models[modelName];
      const tableName = model.getTableName();
      const tbl = (typeof tableName === 'string' ? tableName : tableName.tableName).toLowerCase();

      if (skipTables.includes(tbl)) continue;

      if (!existingSet.has(tbl)) {
        try {
          await model.sync({ force: false });
          created++;
          console.log('[UPDATE] Created table:', tbl);
        } catch (e) {
          console.error('[UPDATE] Error creating table', tbl, ':', e.message);
          errors.push(tbl + ': ' + e.message);
        }
      } else {
        try {
          const tableDesc = await qi.describeTable(tbl);
          const modelAttrs = model.rawAttributes;

          for (const attrName in modelAttrs) {
            const attr = modelAttrs[attrName];
            const fieldName = attr.field || attrName;
            if (!tableDesc[fieldName]) {
              await qi.addColumn(tbl, fieldName, {
                type: attr.type,
                allowNull: attr.allowNull !== false,
                defaultValue: attr.defaultValue !== undefined ? attr.defaultValue : undefined
              });
              altered++;
              console.log('[UPDATE] Added column', fieldName, 'to', tbl);
            }
          }
        } catch (e) {
          console.error('[UPDATE] Error updating table', tbl, ':', e.message);
          errors.push(tbl + ': ' + e.message);
        }
      }
    }

    console.log('[UPDATE] Database update complete. Created:', created, 'Columns added:', altered, 'Errors:', errors.length);

    const currentVersion = req.app.locals.CMS_VERSION || '2.0.0';
    const [setting] = await Setting.findOrCreate({
      where: { key: 'cms_version' },
      defaults: { value: currentVersion }
    });
    if (setting.value !== currentVersion) {
      setting.value = currentVersion;
      await setting.save();
    }

    console.log('[UPDATE] Version updated to', currentVersion);

    if (errors.length > 0) {
      res.redirect('/update?success=1&error=' + encodeURIComponent('Parcial: ' + errors.join('; ')));
    } else {
      res.redirect('/update?success=1');
    }
  } catch (error) {
    console.error('[UPDATE] Error:', error);
    res.redirect('/update?error=' + encodeURIComponent(error.message));
  }
});

module.exports = router;
