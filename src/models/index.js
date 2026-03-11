const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Admin = require('./Admin');
const Game = require('./Game');
const GameFile = require('./GameFile');
const WebDAVConfig = require('./WebDAVConfig');
const WordPressConfig = require('./WordPressConfig');
const Attribute = require('./Attribute');
const Download = require('./Download');
const Setting = require('./Setting');
const Role = require('./Role');
const GameCategory = require('./GameCategory');
const ConsoleDownload = require('./ConsoleDownload');
const GameDownloadCount = require('./GameDownloadCount');
const GameRating = require('./GameRating');
const GameFavorite = require('./GameFavorite');
const FileReport = require('./FileReport');
const PydioConfig = require('./PydioConfig');
const UserProfile = require('./UserProfile');
const Friendship = require('./Friendship');
const GameComment = require('./GameComment');
const UserAchievement = require('./UserAchievement');
const UserGameStats = require('./UserGameStats');
const GameRoom = require('./GameRoom');
const GameRoomParticipant = require('./GameRoomParticipant');
const Notification = require('./Notification');
const StixAchievementDef = require('./StixAchievementDef');
const RoomMessage = require('./RoomMessage');
const BlogPost = require('./BlogPost');
const BlogCategory = require('./BlogCategory');
const BlogComment = require('./BlogComment');
const Event = require('./Event');
const EventType = require('./EventType');
const GameAchievement = require('./GameAchievement');

Game.hasMany(GameFile, { foreignKey: 'game_id', as: 'files', onDelete: 'CASCADE' });
GameFile.belongsTo(Game, { foreignKey: 'game_id', as: 'game' });
Download.belongsTo(GameFile, { foreignKey: 'game_file_id', as: 'gameFile' });
Game.hasMany(GameCategory, { foreignKey: 'game_id', as: 'categories', onDelete: 'CASCADE' });
GameCategory.belongsTo(Game, { foreignKey: 'game_id', as: 'game' });
Game.hasMany(GameDownloadCount, { foreignKey: 'game_id', as: 'downloadCounts', onDelete: 'CASCADE' });
GameDownloadCount.belongsTo(Game, { foreignKey: 'game_id', as: 'game' });
Game.hasMany(GameRating, { foreignKey: 'game_id', as: 'ratings', onDelete: 'CASCADE' });
GameRating.belongsTo(Game, { foreignKey: 'game_id', as: 'game' });
Game.hasMany(GameFavorite, { foreignKey: 'game_id', as: 'favorites', onDelete: 'CASCADE' });
GameFavorite.belongsTo(Game, { foreignKey: 'game_id', as: 'game' });
GameFile.hasMany(FileReport, { foreignKey: 'game_file_id', as: 'reports', onDelete: 'CASCADE' });
FileReport.belongsTo(GameFile, { foreignKey: 'game_file_id', as: 'gameFile', onDelete: 'CASCADE' });

Friendship.belongsTo(UserProfile, { foreignKey: 'requester_id', as: 'requester' });
Friendship.belongsTo(UserProfile, { foreignKey: 'addressee_id', as: 'addressee' });
UserProfile.hasMany(Friendship, { foreignKey: 'requester_id', as: 'sentRequests' });
UserProfile.hasMany(Friendship, { foreignKey: 'addressee_id', as: 'receivedRequests' });

Game.hasMany(GameComment, { foreignKey: 'game_id', as: 'comments', onDelete: 'CASCADE' });
GameComment.belongsTo(Game, { foreignKey: 'game_id', as: 'game' });
UserProfile.hasMany(GameComment, { foreignKey: 'user_profile_id', as: 'comments' });
GameComment.belongsTo(UserProfile, { foreignKey: 'user_profile_id', as: 'userProfile' });

UserProfile.hasMany(UserAchievement, { foreignKey: 'user_profile_id', as: 'achievements', onDelete: 'CASCADE' });
UserAchievement.belongsTo(UserProfile, { foreignKey: 'user_profile_id', as: 'userProfile' });

UserProfile.hasMany(UserGameStats, { foreignKey: 'user_profile_id', as: 'gameStats', onDelete: 'CASCADE' });
UserGameStats.belongsTo(UserProfile, { foreignKey: 'user_profile_id', as: 'userProfile' });
Game.hasMany(UserGameStats, { foreignKey: 'game_id', as: 'userStats', onDelete: 'CASCADE' });
UserGameStats.belongsTo(Game, { foreignKey: 'game_id', as: 'game' });

UserProfile.hasMany(GameRoom, { foreignKey: 'creator_id', as: 'createdRooms' });
GameRoom.belongsTo(UserProfile, { foreignKey: 'creator_id', as: 'creator' });
Game.hasMany(GameRoom, { foreignKey: 'game_id', as: 'rooms' });
GameRoom.belongsTo(Game, { foreignKey: 'game_id', as: 'game' });

GameRoom.hasMany(GameRoomParticipant, { foreignKey: 'room_id', as: 'participants', onDelete: 'CASCADE' });
GameRoomParticipant.belongsTo(GameRoom, { foreignKey: 'room_id', as: 'room' });
UserProfile.hasMany(GameRoomParticipant, { foreignKey: 'user_profile_id', as: 'roomParticipations' });
GameRoomParticipant.belongsTo(UserProfile, { foreignKey: 'user_profile_id', as: 'userProfile' });

UserProfile.hasMany(Notification, { foreignKey: 'user_profile_id', as: 'notifications', onDelete: 'CASCADE' });
Notification.belongsTo(UserProfile, { foreignKey: 'user_profile_id', as: 'userProfile' });

GameRoom.hasMany(RoomMessage, { foreignKey: 'room_id', as: 'messages', onDelete: 'CASCADE' });
RoomMessage.belongsTo(GameRoom, { foreignKey: 'room_id', as: 'room' });
UserProfile.hasMany(RoomMessage, { foreignKey: 'user_profile_id', as: 'roomMessages' });
RoomMessage.belongsTo(UserProfile, { foreignKey: 'user_profile_id', as: 'userProfile' });

Admin.hasMany(BlogPost, { foreignKey: 'admin_id', as: 'blogPosts' });
BlogPost.belongsTo(Admin, { foreignKey: 'admin_id', as: 'author' });

BlogCategory.hasMany(BlogPost, { foreignKey: 'category_id', as: 'posts' });
BlogPost.belongsTo(BlogCategory, { foreignKey: 'category_id', as: 'category' });

BlogPost.hasMany(BlogComment, { foreignKey: 'blog_post_id', as: 'blogComments', onDelete: 'CASCADE' });
BlogComment.belongsTo(BlogPost, { foreignKey: 'blog_post_id', as: 'blogPost' });
UserProfile.hasMany(BlogComment, { foreignKey: 'user_profile_id', as: 'blogComments' });
BlogComment.belongsTo(UserProfile, { foreignKey: 'user_profile_id', as: 'userProfile' });

Admin.hasMany(Event, { foreignKey: 'admin_id', as: 'events' });
Event.belongsTo(Admin, { foreignKey: 'admin_id', as: 'creator' });

Game.hasMany(GameAchievement, { foreignKey: 'game_id', as: 'gameAchievements', onDelete: 'SET NULL' });
GameAchievement.belongsTo(Game, { foreignKey: 'game_id', as: 'game' });

async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log('[DB] Connection established successfully.');

    const qi = sequelize.getQueryInterface();
    const existingTables = await qi.showAllTables();
    const existingSet = new Set(existingTables.map(t => t.toLowerCase()));

    const models = sequelize.models;
    const skipTables = ['sessions'];
    for (const modelName in models) {
      const model = models[modelName];
      const tableName = model.getTableName();
      const tbl = (typeof tableName === 'string' ? tableName : tableName.tableName).toLowerCase();

      if (skipTables.includes(tbl)) continue;

      if (!existingSet.has(tbl)) {
        await model.sync({ force: false });
        console.log('[DB] Created table:', tbl);
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
              console.log('[DB] Added column', fieldName, 'to', tbl);
            }
          }
        } catch (e) {
          console.error('[DB] Error checking table', tbl, ':', e.message);
        }
      }
    }
    console.log('[DB] Models synchronized.');

    try {
      const dialect = sequelize.getDialect();
      if (dialect === 'mysql' || dialect === 'mariadb') {
        const [fks] = await sequelize.query(
          `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE 
           WHERE TABLE_NAME = 'file_reports' AND COLUMN_NAME = 'game_file_id' 
           AND REFERENCED_TABLE_NAME IS NOT NULL AND TABLE_SCHEMA = DATABASE()`
        );
        for (const fk of fks) {
          await sequelize.query(`ALTER TABLE file_reports DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
          console.log('[DB] Dropped old FK:', fk.CONSTRAINT_NAME);
        }
        if (fks.length > 0) {
          await sequelize.query(
            `ALTER TABLE file_reports ADD CONSTRAINT fk_file_reports_game_file 
             FOREIGN KEY (game_file_id) REFERENCES game_files(id) ON DELETE CASCADE ON UPDATE CASCADE`
          );
          console.log('[DB] Recreated file_reports FK with CASCADE');
        }
      } else if (dialect === 'postgres') {
        const [fks] = await sequelize.query(
          `SELECT c.conname, c.confdeltype FROM pg_constraint c 
           WHERE c.conrelid = 'file_reports'::regclass AND c.contype = 'f' 
           AND c.conkey @> ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'file_reports'::regclass AND attname = 'game_file_id')]`
        );
        const needsFix = fks.some(fk => fk.confdeltype !== 'c');
        if (needsFix) {
          for (const fk of fks) {
            await sequelize.query(`ALTER TABLE file_reports DROP CONSTRAINT "${fk.conname}"`);
            console.log('[DB] Dropped old FK:', fk.conname);
          }
          await sequelize.query(
            `ALTER TABLE file_reports ADD CONSTRAINT fk_file_reports_game_file 
             FOREIGN KEY (game_file_id) REFERENCES game_files(id) ON DELETE CASCADE ON UPDATE CASCADE`
          );
          console.log('[DB] Recreated file_reports FK with CASCADE');
        }
      }
    } catch (fkErr) {
      console.log('[DB] FK migration skipped:', fkErr.message);
    }

    const adminCount = await Admin.count();
    if (adminCount === 0) {
      const defaultUser = process.env.ADMIN_USER || 'admin';
      const defaultPass = process.env.ADMIN_PASS || 'admin123';
      const defaultEmail = process.env.ADMIN_EMAIL || 'admin@godsend.local';
      await Admin.create({
        username: defaultUser,
        email: defaultEmail,
        password_hash: defaultPass,
        role: 'super_admin',
        active: true
      });
      console.log(`[DB] Default admin created (user: ${defaultUser}). Change password after first login.`);
    }

    try {
      const dialect = sequelize.getDialect();
      if (existingSet.has('events')) {
        const eventsDesc = await qi.describeTable('events');
        if (eventsDesc.event_type && eventsDesc.event_type.type) {
          const colType = eventsDesc.event_type.type.toUpperCase();
          if (colType.includes('ENUM') || (colType === 'USER-DEFINED')) {
            await qi.changeColumn('events', 'event_type', {
              type: DataTypes.STRING(100),
              defaultValue: 'outro'
            });
            console.log('[DB] Migrated events.event_type from ENUM to VARCHAR(100)');
          }
        }
      }
    } catch (enumErr) {
      console.log('[DB] ENUM migration skipped:', enumErr.message);
    }

    await Attribute.seedDefaults();
    await Role.seedDefaults();
    await StixAchievementDef.seedDefaults();
    await EventType.seedDefaults();

    return true;
  } catch (error) {
    console.error('[DB] Connection failed:', error.message);
    return false;
  }
}

module.exports = {
  sequelize,
  Admin,
  Game,
  GameFile,
  WebDAVConfig,
  WordPressConfig,
  Attribute,
  Download,
  Setting,
  Role,
  GameCategory,
  ConsoleDownload,
  GameDownloadCount,
  GameRating,
  GameFavorite,
  FileReport,
  PydioConfig,
  UserProfile,
  Friendship,
  GameComment,
  UserAchievement,
  UserGameStats,
  GameRoom,
  GameRoomParticipant,
  Notification,
  StixAchievementDef,
  RoomMessage,
  BlogPost,
  BlogCategory,
  BlogComment,
  Event,
  EventType,
  GameAchievement,
  initDatabase
};
