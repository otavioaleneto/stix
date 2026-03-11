const { Event, Admin, EventType } = require('../models');
const { Op } = require('sequelize');

async function listEvents(req, res) {
  try {
    const { search, page = 1, limit: reqLimit } = req.query;
    const limit = parseInt(reqLimit) || 15;
    const validLimits = [15, 30, 50];
    const perPage = validLimits.includes(limit) ? limit : 15;
    const offset = (page - 1) * perPage;
    const where = {};

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: events } = await Event.findAndCountAll({
      where,
      include: [
        { model: Admin, as: 'creator', attributes: ['id', 'username'] }
      ],
      order: [['event_date', 'DESC']],
      limit: perPage,
      offset
    });

    let eventTypes = [];
    try {
      eventTypes = await EventType.findAll({ order: [['name', 'ASC']] });
    } catch (e) {}

    const typeMap = {};
    eventTypes.forEach(t => { typeMap[t.slug] = t; });

    const totalPages = Math.ceil(count / perPage);
    res.render('events/index', {
      title: 'Eventos',
      events,
      search: search || '',
      currentPage: parseInt(page),
      totalPages,
      totalEvents: count,
      perPage,
      typeMap
    });
  } catch (err) {
    console.error('[Events] listEvents error:', err);
    res.render('events/index', {
      title: 'Eventos',
      events: [],
      search: '',
      currentPage: 1,
      totalPages: 0,
      totalEvents: 0,
      perPage: 15,
      typeMap: {}
    });
  }
}

async function createForm(req, res) {
  let eventTypes = [];
  try {
    eventTypes = await EventType.findAll({ order: [['name', 'ASC']] });
  } catch (e) {}
  res.render('events/form', { title: 'Novo Evento', event: null, error: null, eventTypes });
}

async function store(req, res) {
  try {
    const { title, description, event_type, cover_image_url, event_date, event_url, published } = req.body;
    await Event.create({
      admin_id: req.session.adminId,
      title,
      description: description || null,
      event_type: event_type || 'outro',
      cover_image_url: cover_image_url || null,
      event_date: event_date || null,
      event_url: event_url || null,
      published: published === '1' || published === 'true'
    });
    res.redirect('/events');
  } catch (err) {
    console.error('[Events] store error:', err);
    let eventTypes = [];
    try { eventTypes = await EventType.findAll({ order: [['name', 'ASC']] }); } catch (e) {}
    res.render('events/form', { title: 'Novo Evento', event: req.body, error: err.message, eventTypes });
  }
}

async function editForm(req, res) {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event) return res.status(404).render('error', { title: '404', message: 'Evento não encontrado', admin: res.locals.admin });
    let eventTypes = [];
    try { eventTypes = await EventType.findAll({ order: [['name', 'ASC']] }); } catch (e) {}
    res.render('events/form', { title: 'Editar Evento', event, error: null, eventTypes });
  } catch (err) {
    console.error('[Events] editForm error:', err);
    res.status(500).render('error', { title: 'Erro', message: err.message, admin: res.locals.admin });
  }
}

async function update(req, res) {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event) return res.status(404).render('error', { title: '404', message: 'Evento não encontrado', admin: res.locals.admin });

    const { title, description, event_type, cover_image_url, event_date, event_url, published } = req.body;
    await event.update({
      title,
      description: description || null,
      event_type: event_type || 'outro',
      cover_image_url: cover_image_url || null,
      event_date: event_date || null,
      event_url: event_url || null,
      published: published === '1' || published === 'true'
    });
    res.redirect('/events');
  } catch (err) {
    console.error('[Events] update error:', err);
    let eventTypes = [];
    try { eventTypes = await EventType.findAll({ order: [['name', 'ASC']] }); } catch (e) {}
    res.render('events/form', { title: 'Editar Evento', event: req.body, error: err.message, eventTypes });
  }
}

async function destroy(req, res) {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event) return res.status(404).json({ success: false, error: 'Evento não encontrado' });
    await event.destroy();
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.json({ success: true });
    }
    res.redirect('/events');
  } catch (err) {
    console.error('[Events] destroy error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function apiListUpcoming(req, res) {
  try {
    const { page = 1, limit: reqLimit } = req.query;
    const limit = Math.min(parseInt(reqLimit) || 10, 50);
    const offset = (parseInt(page) - 1) * limit;

    const { count, rows: events } = await Event.findAndCountAll({
      where: {
        published: true,
        event_date: { [Op.gte]: new Date() }
      },
      include: [
        { model: Admin, as: 'creator', attributes: ['id', 'username'] }
      ],
      order: [['event_date', 'ASC']],
      limit,
      offset
    });

    res.json({
      success: true,
      events: events.map(e => ({
        id: e.id,
        title: e.title,
        description: e.description,
        event_type: e.event_type,
        cover_image_url: e.cover_image_url,
        event_date: e.event_date,
        event_url: e.event_url,
        creator: e.creator ? e.creator.username : 'Admin',
        created_at: e.createdAt
      })),
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (err) {
    console.error('[Events] apiListUpcoming error:', err);
    res.json({ success: false, events: [], total: 0 });
  }
}

async function uploadImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Nenhuma imagem enviada' });
    }
    const imageUrl = '/uploads/events/' + req.file.filename;
    res.json({ success: true, url: imageUrl });
  } catch (err) {
    console.error('[Events] uploadImage error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { listEvents, createForm, store, editForm, update, destroy, apiListUpcoming, uploadImage };
