const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { profileAuth } = require('../middleware/profileAuth');

router.get('/my', profileAuth, roomController.getMyRooms);

router.post('/', profileAuth, roomController.createRoom);
router.get('/', roomController.listRooms);
router.get('/:id', roomController.getRoom);
router.put('/:id', profileAuth, roomController.updateRoom);
router.delete('/:id', profileAuth, roomController.deleteRoom);

router.put('/:id/finish', profileAuth, roomController.finishRoom);

router.post('/:id/join', profileAuth, roomController.joinRoom);
router.post('/:id/leave', profileAuth, roomController.leaveRoom);
router.post('/:id/invite', profileAuth, roomController.inviteToRoom);

router.get('/:id/messages', profileAuth, roomController.getRoomMessages);
router.post('/:id/messages', profileAuth, roomController.sendRoomMessage);

module.exports = router;
