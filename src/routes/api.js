const express = require('express');
const router = express.Router();
const { apiAuth, apiAuthOptional } = require('../middleware/apiAuth');
const apiController = require('../controllers/apiController');

const authMiddleware = process.env.API_OPEN_ACCESS === 'true' ? apiAuthOptional : apiAuth;

router.use((req, res, next) => {
  res.set('Content-Encoding', 'identity');
  res.set('Cache-Control', 'no-transform');
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, HEAD, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

router.head('/ping', (req, res) => res.status(200).end());
router.get('/ping', (req, res) => res.status(200).json({ status: 'ok' }));

router.get('/auth/login', apiController.authLogin);
router.get('/auth/check', apiController.authCheck);
router.get('/console/register', apiController.registerConsole);
router.get('/guest/check', apiController.guestCheck);
router.get('/guest/track', apiController.guestDownloadTrack);

router.get('/categories', authMiddleware, apiController.listCategories);
router.get('/games', authMiddleware, apiController.listGames);
router.get('/games/:id', authMiddleware, apiController.getGame);
router.get('/games/:id/files', authMiddleware, apiController.getGameFiles);
router.get('/download/report', authMiddleware, apiController.downloadReport);
router.get('/download/:fileId', authMiddleware, apiController.downloadFile);
router.get('/download/:fileId/info', authMiddleware, apiController.downloadFileInfo);
router.get('/browse', authMiddleware, apiController.listDirectoryFiles);
router.get('/browse-file/:fileId', authMiddleware, apiController.browseFiles);
router.get('/lookup', authMiddleware, apiController.lookupByTitleIds);

router.get('/games/:id/rate', authMiddleware, apiController.rateGame);
router.get('/favorites', authMiddleware, apiController.listFavorites);
router.get('/favorites/check', authMiddleware, apiController.checkFavorite);
router.get('/favorites/add', authMiddleware, apiController.addFavorite);
router.get('/favorites/remove', authMiddleware, apiController.removeFavorite);
router.get('/report', authMiddleware, apiController.reportFile);

router.get('/game/by-title-id/:titleId', apiController.getGameByTitleId);
router.get('/dbox/description/:titleId', apiController.dboxDescription);
router.get('/dbox/descriptions', apiController.dboxDescriptionBatch);

router.get('/blog/posts', require('../controllers/blogController').apiListPublished);
router.get('/blog/posts/:id/comments', require('../controllers/blogController').getBlogComments);
router.post('/blog/posts/:id/comments', require('../middleware/profileAuth').profileAuth, require('../controllers/blogController').addBlogComment);
router.delete('/blog/posts/:id/comments/:commentId', require('../middleware/profileAuth').profileAuth, require('../controllers/blogController').deleteBlogComment);
router.get('/games/:titleId/comments', apiController.getGameComments);
router.post('/games/:titleId/comments', require('../middleware/profileAuth').profileAuth, apiController.addGameComment);
router.delete('/games/:titleId/comments/:commentId', require('../middleware/profileAuth').profileAuth, apiController.deleteGameComment);

router.get('/events', require('../controllers/eventController').apiListUpcoming);

router.get('/speedtest', async (req, res) => {
  const sizeMB = parseInt(req.query.size) || 10;
  const cappedSize = Math.min(Math.max(sizeMB, 1), 100);
  const totalBytes = cappedSize * 1024 * 1024;
  const via = req.query.via;

  if (via === 'warp') {
    try {
      const pydioService = require('../services/pydioService');
      const config = await pydioService.getConfig();
      if (!config || !config.warp_proxy_enabled) {
        return res.status(400).json({ success: false, error: 'WARP proxy not enabled' });
      }

      const { SocksProxyAgent } = require('socks-proxy-agent');
      const https = require('https');
      const warpPort = config.warp_proxy_port || 40000;
      const agent = new SocksProxyAgent(`socks5://127.0.0.1:${warpPort}`);

      const testUrl = `https://speed.cloudflare.com/__down?bytes=${totalBytes}`;

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', totalBytes);
      res.setHeader('Content-Disposition', 'attachment; filename=speedtest-warp.bin');
      res.setHeader('Content-Encoding', 'identity');
      res.setHeader('Cache-Control', 'no-store, no-transform');
      res.setHeader('X-Speedtest-Via', 'cloudflare-warp');

      let headersSent = false;
      const proxyReq = https.get(testUrl, { agent, timeout: 120000 }, (proxyRes) => {
        if (proxyRes.statusCode !== 200) {
          proxyRes.resume();
          if (!headersSent) {
            return res.status(502).json({ success: false, error: 'WARP speed test failed: HTTP ' + proxyRes.statusCode });
          }
          return;
        }
        headersSent = true;
        proxyRes.pipe(res);
        proxyRes.on('error', () => { if (!res.writableEnded) res.end(); });
      });
      proxyReq.on('error', (err) => {
        if (!headersSent) {
          return res.status(502).json({ success: false, error: 'WARP connection error: ' + err.message });
        }
        if (!res.writableEnded) res.end();
      });
      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        if (!headersSent) {
          return res.status(504).json({ success: false, error: 'WARP speed test timeout' });
        }
        if (!res.writableEnded) res.end();
      });
      req.on('close', () => { proxyReq.destroy(); });
      return;
    } catch (err) {
      return res.status(500).json({ success: false, error: 'WARP speedtest error: ' + err.message });
    }
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', totalBytes);
  res.setHeader('Content-Disposition', 'attachment; filename=speedtest.bin');
  res.setHeader('Content-Encoding', 'identity');
  res.setHeader('Cache-Control', 'no-store, no-transform');
  res.setHeader('X-Speedtest-Via', 'direct');

  const chunkSize = 65536;
  const chunk = Buffer.alloc(chunkSize, 0x41);
  let sent = 0;

  function writeChunk() {
    while (sent < totalBytes) {
      const remaining = totalBytes - sent;
      const toWrite = remaining < chunkSize ? chunk.slice(0, remaining) : chunk;
      const ok = res.write(toWrite);
      sent += toWrite.length;
      if (!ok) {
        res.once('drain', writeChunk);
        return;
      }
    }
    res.end();
  }

  req.on('close', () => { sent = totalBytes; });
  writeChunk();
});

module.exports = router;
