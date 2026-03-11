const { EventType, Event } = require('../models');
const { Op } = require('sequelize');

function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function listTypes(req, res) {
  try {
    const types = await EventType.findAll({
      order: [['name', 'ASC']]
    });

    const typesWithCount = await Promise.all(types.map(async (t) => {
      const eventCount = await Event.count({ where: { event_type: t.slug } });
      return { ...t.toJSON(), eventCount };
    }));

    res.render('events/types', {
      title: 'Tipos de Evento',
      types: typesWithCount
    });
  } catch (err) {
    console.error('[EventType] listTypes error:', err);
    res.render('events/types', {
      title: 'Tipos de Evento',
      types: []
    });
  }
}

async function createForm(req, res) {
  res.render('events/type-form', { title: 'Novo Tipo de Evento', eventType: null, error: null });
}

async function store(req, res) {
  try {
    const { name, color } = req.body;
    let slug = generateSlug(name);

    const existing = await EventType.findOne({ where: { slug } });
    if (existing) {
      slug = slug + '-' + Date.now();
    }

    await EventType.create({ name, slug, color: color || '#8b8ba3' });
    res.redirect('/events/types');
  } catch (err) {
    console.error('[EventType] store error:', err);
    res.render('events/type-form', { title: 'Novo Tipo de Evento', eventType: req.body, error: err.message });
  }
}

async function editForm(req, res) {
  try {
    const eventType = await EventType.findByPk(req.params.id);
    if (!eventType) return res.status(404).render('error', { title: '404', message: 'Tipo de evento não encontrado', admin: res.locals.admin });
    res.render('events/type-form', { title: 'Editar Tipo de Evento', eventType, error: null });
  } catch (err) {
    console.error('[EventType] editForm error:', err);
    res.status(500).render('error', { title: 'Erro', message: err.message, admin: res.locals.admin });
  }
}

async function update(req, res) {
  try {
    const eventType = await EventType.findByPk(req.params.id);
    if (!eventType) return res.status(404).render('error', { title: '404', message: 'Tipo de evento não encontrado', admin: res.locals.admin });

    const { name, color } = req.body;
    let slug = generateSlug(name);

    const existing = await EventType.findOne({ where: { slug, id: { [Op.ne]: eventType.id } } });
    if (existing) {
      slug = slug + '-' + Date.now();
    }

    const oldSlug = eventType.slug;
    await eventType.update({ name, slug, color: color || '#8b8ba3' });

    if (oldSlug !== slug) {
      await Event.update({ event_type: slug }, { where: { event_type: oldSlug } });
    }

    res.redirect('/events/types');
  } catch (err) {
    console.error('[EventType] update error:', err);
    res.render('events/type-form', { title: 'Editar Tipo de Evento', eventType: req.body, error: err.message });
  }
}

async function destroy(req, res) {
  try {
    const eventType = await EventType.findByPk(req.params.id);
    if (!eventType) return res.status(404).json({ success: false, error: 'Tipo de evento não encontrado' });

    await Event.update({ event_type: 'outro' }, { where: { event_type: eventType.slug } });
    await eventType.destroy();

    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.json({ success: true });
    }
    res.redirect('/events/types');
  } catch (err) {
    console.error('[EventType] destroy error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { listTypes, createForm, store, editForm, update, destroy };
