const { BlogPost, Admin, BlogCategory, BlogComment, UserProfile } = require('../models');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');

async function autoPublishScheduled() {
  try {
    const now = new Date();
    await BlogPost.update(
      { published: true },
      {
        where: {
          published: false,
          published_at: { [Op.ne]: null, [Op.lte]: now }
        }
      }
    );
  } catch (err) {
    console.error('[Blog] autoPublishScheduled error:', err);
  }
}

async function listPosts(req, res) {
  try {
    await autoPublishScheduled();

    const { search, page = 1, limit: reqLimit, category_id } = req.query;
    const limit = parseInt(reqLimit) || 15;
    const validLimits = [15, 30, 50];
    const finalLimit = validLimits.includes(limit) ? limit : 15;
    const offset = (page - 1) * finalLimit;
    const where = {};

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { content: { [Op.like]: `%${search}%` } }
      ];
    }

    if (category_id) {
      where.category_id = parseInt(category_id);
    }

    const categories = await BlogCategory.findAll({ order: [['name', 'ASC']] });

    const { count, rows: posts } = await BlogPost.findAndCountAll({
      where,
      include: [
        { model: Admin, as: 'author', attributes: ['id', 'username'] },
        { model: BlogCategory, as: 'category', attributes: ['id', 'name', 'slug'] }
      ],
      order: [['pinned', 'DESC'], ['createdAt', 'DESC']],
      limit: finalLimit,
      offset
    });

    const totalPages = Math.ceil(count / finalLimit);
    res.render('blog/index', {
      title: 'Blog',
      posts,
      search: search || '',
      currentPage: parseInt(page),
      totalPages,
      totalPosts: count,
      perPage: finalLimit,
      categories,
      selectedCategory: category_id || ''
    });
  } catch (err) {
    console.error('[Blog] listPosts error:', err);
    res.render('blog/index', {
      title: 'Blog',
      posts: [],
      search: '',
      currentPage: 1,
      totalPages: 0,
      totalPosts: 0,
      perPage: 15,
      categories: [],
      selectedCategory: ''
    });
  }
}

async function createForm(req, res) {
  const categories = await BlogCategory.findAll({ order: [['name', 'ASC']] });
  res.render('blog/form', { title: 'Novo Post', post: null, error: null, categories });
}

async function store(req, res) {
  try {
    const { title, content, cover_image_url, published, published_at, category_id } = req.body;
    let isPublished = published === '1' || published === 'true';
    let pubDate = null;

    if (published_at) {
      pubDate = new Date(published_at);
      if (pubDate > new Date()) {
        isPublished = false;
      }
    } else if (isPublished) {
      pubDate = new Date();
    }

    const { pinned } = req.body;
    await BlogPost.create({
      admin_id: req.session.adminId,
      title,
      content,
      cover_image_url: cover_image_url || null,
      published: isPublished,
      published_at: pubDate,
      category_id: category_id ? parseInt(category_id) : null,
      pinned: pinned === '1' || pinned === 'true'
    });
    res.redirect('/blog');
  } catch (err) {
    console.error('[Blog] store error:', err);
    const categories = await BlogCategory.findAll({ order: [['name', 'ASC']] });
    res.render('blog/form', { title: 'Novo Post', post: req.body, error: err.message, categories });
  }
}

async function editForm(req, res) {
  try {
    const post = await BlogPost.findByPk(req.params.id);
    if (!post) return res.status(404).render('error', { title: '404', message: 'Post não encontrado', admin: res.locals.admin });
    const categories = await BlogCategory.findAll({ order: [['name', 'ASC']] });
    res.render('blog/form', { title: 'Editar Post', post, error: null, categories });
  } catch (err) {
    console.error('[Blog] editForm error:', err);
    res.status(500).render('error', { title: 'Erro', message: err.message, admin: res.locals.admin });
  }
}

async function update(req, res) {
  try {
    const post = await BlogPost.findByPk(req.params.id);
    if (!post) return res.status(404).render('error', { title: '404', message: 'Post não encontrado', admin: res.locals.admin });

    const { title, content, cover_image_url, published, published_at, category_id } = req.body;
    let isPublished = published === '1' || published === 'true';
    let pubDate = post.published_at;

    if (published_at) {
      pubDate = new Date(published_at);
      if (pubDate > new Date()) {
        isPublished = false;
      }
    } else if (isPublished && !post.published) {
      pubDate = new Date();
    }

    const { pinned } = req.body;
    await post.update({
      title,
      content,
      cover_image_url: cover_image_url || null,
      published: isPublished,
      published_at: pubDate,
      category_id: category_id ? parseInt(category_id) : null,
      pinned: pinned === '1' || pinned === 'true'
    });
    res.redirect('/blog');
  } catch (err) {
    console.error('[Blog] update error:', err);
    const categories = await BlogCategory.findAll({ order: [['name', 'ASC']] });
    res.render('blog/form', { title: 'Editar Post', post: req.body, error: err.message, categories });
  }
}

async function destroy(req, res) {
  try {
    const post = await BlogPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ success: false, error: 'Post não encontrado' });
    await post.destroy();
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.json({ success: true });
    }
    res.redirect('/blog');
  } catch (err) {
    console.error('[Blog] destroy error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function apiListPublished(req, res) {
  try {
    await autoPublishScheduled();

    const { page = 1, limit: reqLimit } = req.query;
    const limit = Math.min(parseInt(reqLimit) || 10, 50);
    const offset = (parseInt(page) - 1) * limit;

    const where = {
      published: true,
      [Op.or]: [
        { published_at: null },
        { published_at: { [Op.lte]: new Date() } }
      ]
    };
    const { category } = req.query;
    if (category) {
      const cat = await BlogCategory.findOne({ where: { slug: category } });
      if (cat) {
        where.category_id = cat.id;
      }
    }

    const { count, rows: posts } = await BlogPost.findAndCountAll({
      where,
      include: [
        { model: Admin, as: 'author', attributes: ['id', 'username'] },
        { model: BlogCategory, as: 'category', attributes: ['id', 'name', 'slug'] }
      ],
      order: [['pinned', 'DESC'], ['published_at', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      posts: posts.map(p => ({
        id: p.id,
        title: p.title,
        content: p.content,
        cover_image_url: p.cover_image_url,
        author: p.author ? p.author.username : 'Admin',
        category: p.category ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : null,
        published_at: p.published_at,
        created_at: p.createdAt,
        pinned: !!p.pinned
      })),
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit)
    });
  } catch (err) {
    console.error('[Blog] apiListPublished error:', err);
    res.json({ success: false, posts: [], total: 0 });
  }
}

async function uploadImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Nenhuma imagem enviada' });
    }
    const imageUrl = '/uploads/blog/' + req.file.filename;
    res.json({ success: true, url: imageUrl });
  } catch (err) {
    console.error('[Blog] uploadImage error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function getBlogComments(req, res) {
  try {
    const postId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { count, rows: comments } = await BlogComment.findAndCountAll({
      where: { blog_post_id: postId },
      include: [
        { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      comments,
      total: count,
      page,
      pages: Math.ceil(count / limit)
    });
  } catch (err) {
    console.error('[Blog] getBlogComments error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function addBlogComment(req, res) {
  try {
    const postId = parseInt(req.params.id);
    const { comment_text } = req.body;

    if (!comment_text || !comment_text.trim()) {
      return res.status(400).json({ success: false, error: 'Comment text required' });
    }

    const post = await BlogPost.findByPk(postId);
    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const comment = await BlogComment.create({
      blog_post_id: postId,
      user_profile_id: req.userProfileId,
      comment_text: comment_text.trim()
    });

    const commentWithUser = await BlogComment.findByPk(comment.id, {
      include: [
        { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
      ]
    });

    res.json({ success: true, comment: commentWithUser });
  } catch (err) {
    console.error('[Blog] addBlogComment error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function deleteBlogComment(req, res) {
  try {
    const commentId = parseInt(req.params.commentId);
    const comment = await BlogComment.findByPk(commentId);

    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    if (comment.user_profile_id !== req.userProfileId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    await comment.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('[Blog] deleteBlogComment error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function adminDeleteBlogComment(req, res) {
  try {
    const commentId = parseInt(req.params.commentId);
    const comment = await BlogComment.findByPk(commentId);

    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    await comment.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('[Blog] adminDeleteBlogComment error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { listPosts, createForm, store, editForm, update, destroy, apiListPublished, uploadImage, getBlogComments, addBlogComment, deleteBlogComment, adminDeleteBlogComment };
