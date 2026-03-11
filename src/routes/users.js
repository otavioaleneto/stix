const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const usersController = require('../controllers/usersController');

router.get('/', requireAuth, usersController.index);

module.exports = router;
