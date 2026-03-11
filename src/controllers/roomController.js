const { Op } = require('sequelize');
const { GameRoom, GameRoomParticipant, UserProfile, Game, Notification, Friendship, RoomMessage } = require('../models');
const pushService = require('../services/pushService');
const achievementService = require('../services/achievementService');

exports.createRoom = async (req, res) => {
  try {
    const { title, game_id, game_title, scheduled_at, timezone, max_players, is_public, server_type } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const roomData = {
      creator_id: req.userProfileId,
      title: title.trim(),
      game_id: game_id || null,
      game_title: game_title || null,
      scheduled_at: scheduled_at || null,
      timezone: timezone || 'America/Sao_Paulo',
      max_players: max_players || 4,
      is_public: is_public !== undefined ? is_public : true,
      server_type: (server_type === 'stealth_server') ? 'stealth_server' : 'system_link',
      status: 'scheduled'
    };

    if (game_id && !game_title) {
      const game = await Game.findByPk(game_id);
      if (game) {
        roomData.game_title = game.title;
      }
    }

    const room = await GameRoom.create(roomData);

    await GameRoomParticipant.create({
      room_id: room.id,
      user_profile_id: req.userProfileId,
      status: 'joined',
      invited_at: new Date(),
      responded_at: new Date()
    });

    const fullRoom = await GameRoom.findByPk(room.id, {
      include: [
        { model: UserProfile, as: 'creator', attributes: ['id', 'username', 'display_name', 'avatar_url'] },
        { model: Game, as: 'game', attributes: ['id', 'title', 'cover_image', 'title_id'] },
        { model: GameRoomParticipant, as: 'participants', include: [
          { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
        ]}
      ]
    });

    res.json({ success: true, room: fullRoom });

    achievementService.checkAndAward(req.userProfileId).catch(function() {});
  } catch (error) {
    console.error('[ROOMS] Create room error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.listRooms = async (req, res) => {
  try {
    exports.autoCompleteRooms().catch(function() {});

    const { game_id, upcoming, status } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const where = { is_public: true };

    if (game_id) {
      where.game_id = parseInt(game_id);
    }

    if (upcoming === 'true') {
      where.scheduled_at = { [Op.gte]: new Date() };
      where.status = { [Op.in]: ['scheduled', 'active'] };
    }

    if (status) {
      where.status = status;
    }

    const { count, rows: rooms } = await GameRoom.findAndCountAll({
      where,
      include: [
        { model: UserProfile, as: 'creator', attributes: ['id', 'username', 'display_name', 'avatar_url'] },
        { model: Game, as: 'game', attributes: ['id', 'title', 'cover_image', 'title_id'] },
        { model: GameRoomParticipant, as: 'participants', include: [
          { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
        ]}
      ],
      order: [['scheduled_at', 'ASC'], ['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      rooms,
      total: count,
      page,
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('[ROOMS] List rooms error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getRoom = async (req, res) => {
  try {
    const room = await GameRoom.findByPk(req.params.id, {
      include: [
        { model: UserProfile, as: 'creator', attributes: ['id', 'username', 'display_name', 'avatar_url'] },
        { model: Game, as: 'game', attributes: ['id', 'title', 'cover_image', 'title_id'] },
        { model: GameRoomParticipant, as: 'participants', include: [
          { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
        ]}
      ]
    });

    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    res.json({ success: true, room });
  } catch (error) {
    console.error('[ROOMS] Get room error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const room = await GameRoom.findByPk(req.params.id);

    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    if (room.creator_id !== req.userProfileId) {
      return res.status(403).json({ success: false, error: 'Only the room creator can update it' });
    }

    const { title, game_id, game_title, scheduled_at, timezone, max_players, is_public, status } = req.body;
    const updates = {};

    if (title !== undefined) updates.title = title.trim();
    if (game_id !== undefined) updates.game_id = game_id;
    if (game_title !== undefined) updates.game_title = game_title;
    if (scheduled_at !== undefined) updates.scheduled_at = scheduled_at;
    if (timezone !== undefined) updates.timezone = timezone;
    if (max_players !== undefined) updates.max_players = max_players;
    if (is_public !== undefined) updates.is_public = is_public;
    if (status !== undefined) updates.status = status;

    await room.update(updates);

    const fullRoom = await GameRoom.findByPk(room.id, {
      include: [
        { model: UserProfile, as: 'creator', attributes: ['id', 'username', 'display_name', 'avatar_url'] },
        { model: Game, as: 'game', attributes: ['id', 'title', 'cover_image', 'title_id'] },
        { model: GameRoomParticipant, as: 'participants', include: [
          { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
        ]}
      ]
    });

    res.json({ success: true, room: fullRoom });
  } catch (error) {
    console.error('[ROOMS] Update room error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const room = await GameRoom.findByPk(req.params.id);

    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    if (room.creator_id !== req.userProfileId) {
      return res.status(403).json({ success: false, error: 'Only the room creator can cancel it' });
    }

    await room.update({ status: 'cancelled' });

    const participants = await GameRoomParticipant.findAll({
      where: { room_id: room.id, user_profile_id: { [Op.ne]: req.userProfileId } }
    });

    for (const participant of participants) {
      const cancelMsg = `A sala "${room.title}" foi cancelada pelo criador.`;
      await Notification.create({
        user_profile_id: participant.user_profile_id,
        type: 'room_reminder',
        title: 'Sala Cancelada',
        message: cancelMsg,
        data: { room_id: room.id }
      });
      pushService.sendPush(participant.user_profile_id, 'Sala Cancelada', cancelMsg, { type: 'room_reminder', room_id: room.id });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[ROOMS] Delete room error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.joinRoom = async (req, res) => {
  try {
    const room = await GameRoom.findByPk(req.params.id, {
      include: [{ model: GameRoomParticipant, as: 'participants' }]
    });

    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    if (room.status === 'cancelled' || room.status === 'finished') {
      return res.status(400).json({ success: false, error: 'Room is no longer active' });
    }

    const activeParticipants = room.participants.filter(p => p.status === 'joined' || p.status === 'confirmed');
    if (activeParticipants.length >= room.max_players) {
      return res.status(400).json({ success: false, error: 'Room is full' });
    }

    let participant = await GameRoomParticipant.findOne({
      where: { room_id: room.id, user_profile_id: req.userProfileId }
    });

    if (participant) {
      await participant.update({ status: 'joined', responded_at: new Date() });
    } else {
      if (!room.is_public) {
        return res.status(403).json({ success: false, error: 'This is a private room. You need an invite.' });
      }
      participant = await GameRoomParticipant.create({
        room_id: room.id,
        user_profile_id: req.userProfileId,
        status: 'joined',
        invited_at: new Date(),
        responded_at: new Date()
      });
    }

    const joinMsg = `${req.userProfile.display_name || req.userProfile.username} entrou na sala "${room.title}".`;
    await Notification.create({
      user_profile_id: room.creator_id,
      type: 'room_reminder',
      title: 'Novo Jogador',
      message: joinMsg,
      data: { room_id: room.id, user_profile_id: req.userProfileId }
    });
    pushService.sendPush(room.creator_id, 'Novo Jogador', joinMsg, { type: 'room_reminder', room_id: room.id });

    res.json({ success: true, participant });
  } catch (error) {
    console.error('[ROOMS] Join room error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.leaveRoom = async (req, res) => {
  try {
    const participant = await GameRoomParticipant.findOne({
      where: { room_id: req.params.id, user_profile_id: req.userProfileId }
    });

    if (!participant) {
      return res.status(404).json({ success: false, error: 'You are not in this room' });
    }

    const room = await GameRoom.findByPk(req.params.id);

    if (room && room.creator_id === req.userProfileId) {
      return res.status(400).json({ success: false, error: 'Room creator cannot leave. Cancel the room instead.' });
    }

    await participant.destroy();

    if (room) {
      const leaveMsg = `${req.userProfile.display_name || req.userProfile.username} saiu da sala "${room.title}".`;
      await Notification.create({
        user_profile_id: room.creator_id,
        type: 'room_reminder',
        title: 'Jogador Saiu',
        message: leaveMsg,
        data: { room_id: room.id, user_profile_id: req.userProfileId }
      });
      pushService.sendPush(room.creator_id, 'Jogador Saiu', leaveMsg, { type: 'room_reminder', room_id: room.id });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[ROOMS] Leave room error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.inviteToRoom = async (req, res) => {
  try {
    const room = await GameRoom.findByPk(req.params.id, {
      include: [{ model: GameRoomParticipant, as: 'participants' }]
    });

    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    if (room.creator_id !== req.userProfileId) {
      const isParticipant = room.participants.some(
        p => p.user_profile_id === req.userProfileId && (p.status === 'joined' || p.status === 'confirmed')
      );
      if (!isParticipant) {
        return res.status(403).json({ success: false, error: 'Only room members can invite others' });
      }
    }

    const { friend_ids } = req.body;
    if (!friend_ids || !Array.isArray(friend_ids) || friend_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'friend_ids array required' });
    }

    const invited = [];
    const errors = [];

    for (const friendId of friend_ids) {
      const friendProfile = await UserProfile.findByPk(friendId);
      if (!friendProfile) {
        errors.push({ friend_id: friendId, error: 'User not found' });
        continue;
      }

      const friendship = await Friendship.findOne({
        where: {
          status: 'accepted',
          [Op.or]: [
            { requester_id: req.userProfileId, addressee_id: friendId },
            { requester_id: friendId, addressee_id: req.userProfileId }
          ]
        }
      });
      if (!friendship) {
        errors.push({ friend_id: friendId, error: 'Not a friend' });
        continue;
      }

      const existing = await GameRoomParticipant.findOne({
        where: { room_id: room.id, user_profile_id: friendId }
      });

      if (existing) {
        errors.push({ friend_id: friendId, error: 'Already in room or invited' });
        continue;
      }

      const activeParticipants = room.participants.filter(p => p.status === 'joined' || p.status === 'confirmed');
      if (activeParticipants.length + invited.length >= room.max_players) {
        errors.push({ friend_id: friendId, error: 'Room is full' });
        continue;
      }

      const participant = await GameRoomParticipant.create({
        room_id: room.id,
        user_profile_id: friendId,
        status: 'invited',
        invited_at: new Date()
      });

      const inviteMsg = `${req.userProfile.display_name || req.userProfile.username} convidou você para a sala "${room.title}".`;
      await Notification.create({
        user_profile_id: friendId,
        type: 'room_invite',
        title: 'Convite para Sala',
        message: inviteMsg,
        data: { room_id: room.id, inviter_id: req.userProfileId }
      });
      pushService.sendPush(friendId, 'Convite para Sala', inviteMsg, { type: 'room_invite', room_id: room.id });

      invited.push(participant);
    }

    res.json({ success: true, invited, errors });
  } catch (error) {
    console.error('[ROOMS] Invite to room error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getRoomMessages = async (req, res) => {
  try {
    const roomId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const after = req.query.after ? parseInt(req.query.after) : null;
    const offset = (page - 1) * limit;

    const room = await GameRoom.findByPk(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const profileId = req.userProfileId || null;
    if (!profileId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    const isCreator = room.creator_id === profileId;
    if (!isCreator) {
      const membership = await GameRoomParticipant.findOne({ where: { room_id: roomId, user_profile_id: profileId } });
      if (!membership) {
        return res.status(403).json({ success: false, error: 'You must be a participant to view messages' });
      }
    }

    const where = { room_id: roomId };
    if (after) {
      where.id = { [Op.gt]: after };
    }

    const { count, rows: messages } = await RoomMessage.findAndCountAll({
      where,
      include: [
        { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
      ],
      order: [['createdAt', 'ASC']],
      limit,
      offset: after ? 0 : offset
    });

    res.json({
      success: true,
      messages,
      total: count,
      page,
      pages: Math.ceil(count / limit)
    });
  } catch (error) {
    console.error('[ROOMS] Get messages error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.sendRoomMessage = async (req, res) => {
  try {
    const roomId = parseInt(req.params.id);
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    const room = await GameRoom.findByPk(roomId);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    if (room.status === 'finished' || room.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Cannot send messages to a ' + room.status + ' room' });
    }

    const participant = await GameRoomParticipant.findOne({
      where: {
        room_id: roomId,
        user_profile_id: req.userProfileId,
        status: { [Op.in]: ['joined', 'confirmed'] }
      }
    });

    if (!participant) {
      return res.status(403).json({ success: false, error: 'You must be a participant to send messages' });
    }

    const roomMessage = await RoomMessage.create({
      room_id: roomId,
      user_profile_id: req.userProfileId,
      message: message.trim().substring(0, 1000)
    });

    const fullMessage = await RoomMessage.findByPk(roomMessage.id, {
      include: [
        { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
      ]
    });

    res.json({ success: true, message: fullMessage });
  } catch (error) {
    console.error('[ROOMS] Send message error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.finishRoom = async (req, res) => {
  try {
    const room = await GameRoom.findByPk(req.params.id);

    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    if (room.creator_id !== req.userProfileId) {
      return res.status(403).json({ success: false, error: 'Only the room creator can finish it' });
    }

    if (room.status === 'cancelled' || room.status === 'finished') {
      return res.status(400).json({ success: false, error: 'Room is already ' + room.status });
    }

    await room.update({ status: 'finished' });

    const fullRoom = await GameRoom.findByPk(room.id, {
      include: [
        { model: UserProfile, as: 'creator', attributes: ['id', 'username', 'display_name', 'avatar_url'] },
        { model: Game, as: 'game', attributes: ['id', 'title', 'cover_image', 'title_id'] },
        { model: GameRoomParticipant, as: 'participants', include: [
          { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
        ]}
      ]
    });

    res.json({ success: true, room: fullRoom });
  } catch (error) {
    console.error('[ROOMS] Finish room error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.autoCompleteRooms = async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [count] = await GameRoom.update(
      { status: 'finished' },
      {
        where: {
          status: { [Op.in]: ['scheduled', 'active'] },
          createdAt: { [Op.lt]: cutoff }
        }
      }
    );
    if (count > 0) {
      console.log('[ROOMS] Auto-completed ' + count + ' rooms older than 24h');
    }
  } catch (error) {
    console.error('[ROOMS] Auto-complete error:', error.message);
  }
};

exports.getMyRooms = async (req, res) => {
  try {
    const profileId = req.userProfileId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const createdRooms = await GameRoom.findAll({
      where: { creator_id: profileId, status: { [Op.ne]: 'cancelled' } },
      include: [
        { model: UserProfile, as: 'creator', attributes: ['id', 'username', 'display_name', 'avatar_url'] },
        { model: Game, as: 'game', attributes: ['id', 'title', 'cover_image', 'title_id'] },
        { model: GameRoomParticipant, as: 'participants', include: [
          { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
        ]}
      ],
      order: [['scheduled_at', 'ASC'], ['createdAt', 'DESC']]
    });

    const participations = await GameRoomParticipant.findAll({
      where: {
        user_profile_id: profileId,
        status: { [Op.in]: ['joined', 'confirmed', 'invited'] }
      },
      include: [{
        model: GameRoom,
        as: 'room',
        where: {
          creator_id: { [Op.ne]: profileId },
          status: { [Op.ne]: 'cancelled' }
        },
        include: [
          { model: UserProfile, as: 'creator', attributes: ['id', 'username', 'display_name', 'avatar_url'] },
          { model: Game, as: 'game', attributes: ['id', 'title', 'cover_image', 'title_id'] },
          { model: GameRoomParticipant, as: 'participants', include: [
            { model: UserProfile, as: 'userProfile', attributes: ['id', 'username', 'display_name', 'avatar_url'] }
          ]}
        ]
      }]
    });

    const participatingRooms = participations.map(p => p.room).filter(Boolean);

    res.json({
      success: true,
      created: createdRooms,
      participating: participatingRooms
    });
  } catch (error) {
    console.error('[ROOMS] Get my rooms error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
