const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { profileAuth, profileAuthOptional } = require('../middleware/profileAuth');

router.post('/profile/login', profileController.login);

router.post('/profile/set-primary-xuid', profileAuth, profileController.setPrimaryXuid);
router.get('/profile/lookup', profileController.lookupByFriendCode);

router.get('/profile/:id', profileController.getProfile);
router.put('/profile/:id', profileAuth, profileController.updateProfile);
router.get('/profile/:id/stats', profileController.getStats);

router.get('/profile/:id/friends', profileController.getFriends);
router.post('/profile/:id/friends', profileAuth, profileController.sendFriendRequest);
router.put('/profile/friends/:friendshipId', profileAuth, profileController.respondFriendRequest);
router.delete('/profile/friends/:friendshipId', profileAuth, profileController.removeFriend);

router.get('/games/:gameId/comments', profileController.getGameComments);
router.post('/games/:gameId/comments', profileAuth, profileController.addGameComment);
router.delete('/games/:gameId/comments/:commentId', profileAuth, profileController.deleteGameComment);

router.get('/profile/:id/favorites', profileController.getUserFavorites);
router.get('/profile/:id/achievements', profileController.getAchievements);
router.post('/profile/:id/achievements/harvest', profileAuth, profileController.harvestAchievements);
router.get('/profile/:id/gamestats', profileController.getGameStats);
router.post('/profile/:id/gamestats', profileAuth, profileController.updateGameStats);

router.get('/profile/:id/notifications', profileAuth, profileController.getNotifications);
router.put('/profile/notifications/:id/read', profileAuth, profileController.markNotificationRead);

router.get('/push/vapid-key', profileController.getVapidPublicKey);
router.post('/profile/push/subscribe', profileAuth, profileController.pushSubscribe);

module.exports = router;
