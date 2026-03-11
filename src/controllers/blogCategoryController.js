const { BlogCategory, BlogPost } = require('../models');
const { Op } = require('sequelize');

function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function listCategories(req, res) {
  try {
    const categories = await BlogCategory.findAll({
      order: [['name', 'ASC']]
    });

    const categoriesWithCount = await Promise.all(categories.map(async (cat) => {
      const postCount = await BlogPost.count({ where: { category_id: cat.id } });
      return { ...cat.toJSON(), postCount };
    }));

    res.render('blog/categories', {
      title: 'Categorias do Blog',
      categories: categoriesWithCount
    });
  } catch (err) {
    console.error('[BlogCategory] listCategories error:', err);
    res.render('blog/categories', {
      title: 'Categorias do Blog',
      categories: []
    });
  }
}

async function createForm(req, res) {
  res.render('blog/category-form', { title: 'Nova Categoria', category: null, error: null });
}

async function store(req, res) {
  try {
    const { name, description } = req.body;
    let slug = generateSlug(name);

    const existing = await BlogCategory.findOne({ where: { slug } });
    if (existing) {
      slug = slug + '-' + Date.now();
    }

    await BlogCategory.create({ name, slug, description: description || null });
    res.redirect('/blog/categories');
  } catch (err) {
    console.error('[BlogCategory] store error:', err);
    res.render('blog/category-form', { title: 'Nova Categoria', category: req.body, error: err.message });
  }
}

async function editForm(req, res) {
  try {
    const category = await BlogCategory.findByPk(req.params.id);
    if (!category) return res.status(404).render('error', { title: '404', message: 'Categoria não encontrada', admin: res.locals.admin });
    res.render('blog/category-form', { title: 'Editar Categoria', category, error: null });
  } catch (err) {
    console.error('[BlogCategory] editForm error:', err);
    res.status(500).render('error', { title: 'Erro', message: err.message, admin: res.locals.admin });
  }
}

async function update(req, res) {
  try {
    const category = await BlogCategory.findByPk(req.params.id);
    if (!category) return res.status(404).render('error', { title: '404', message: 'Categoria não encontrada', admin: res.locals.admin });

    const { name, description } = req.body;
    let slug = generateSlug(name);

    const existing = await BlogCategory.findOne({ where: { slug, id: { [Op.ne]: category.id } } });
    if (existing) {
      slug = slug + '-' + Date.now();
    }

    await category.update({ name, slug, description: description || null });
    res.redirect('/blog/categories');
  } catch (err) {
    console.error('[BlogCategory] update error:', err);
    res.render('blog/category-form', { title: 'Editar Categoria', category: req.body, error: err.message });
  }
}

async function destroy(req, res) {
  try {
    const category = await BlogCategory.findByPk(req.params.id);
    if (!category) return res.status(404).json({ success: false, error: 'Categoria não encontrada' });

    await BlogPost.update({ category_id: null }, { where: { category_id: category.id } });
    await category.destroy();

    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.json({ success: true });
    }
    res.redirect('/blog/categories');
  } catch (err) {
    console.error('[BlogCategory] destroy error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { listCategories, createForm, store, editForm, update, destroy };
