const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const social = require('../controllers/socialController');

function checkSocialPermission(req, res, next) {
  const admin = res.locals.admin;
  if (!admin) return res.redirect('/login');
  const perms = res.locals.permissions || {};
  if (admin.role === 'super_admin' || admin.role === 'admin' || perms.manage_settings) {
    return next();
  }
  return res.status(403).render('error', { title: 'Acesso Negado', message: 'Sem permissão.' });
}

router.get('/rooms', requireAuth, checkSocialPermission, social.listRooms);
router.get('/rooms/:id/view', requireAuth, checkSocialPermission, social.viewRoom);
router.get('/rooms/:id/edit', requireAuth, checkSocialPermission, social.editRoom);
router.post('/rooms/:id', requireAuth, checkSocialPermission, social.updateRoom);
router.post('/rooms/:id/delete', requireAuth, checkSocialPermission, social.deleteRoom);

router.get('/comments', requireAuth, checkSocialPermission, social.listComments);
router.post('/comments/:id/delete', requireAuth, checkSocialPermission, social.deleteComment);

router.get('/achievements', requireAuth, checkSocialPermission, social.listAchievements);
router.get('/achievements/new', requireAuth, checkSocialPermission, social.createAchievementForm);
router.post('/achievements', requireAuth, checkSocialPermission, social.storeAchievement);
router.get('/achievements/:id/edit', requireAuth, checkSocialPermission, social.editAchievementForm);
router.post('/achievements/:id', requireAuth, checkSocialPermission, social.updateAchievement);
router.post('/achievements/:id/delete', requireAuth, checkSocialPermission, social.deleteAchievement);
router.post('/achievements/award', requireAuth, checkSocialPermission, social.awardAchievement);

router.get('/game-achievements', requireAuth, checkSocialPermission, social.listGameAchievements);

router.get('/profiles', requireAuth, checkSocialPermission, social.listProfiles);
router.get('/profiles/:id', requireAuth, checkSocialPermission, social.showProfile);
router.get('/profiles/:id/edit', requireAuth, checkSocialPermission, social.editProfileForm);
router.post('/profiles/:id', requireAuth, checkSocialPermission, social.updateProfile);

module.exports = router;
