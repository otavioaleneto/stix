const { WebDAVConfig, WordPressConfig, Setting, PydioConfig } = require('../models');
const webdavService = require('../services/webdavService');
const wordpressService = require('../services/wordpressService');
const pydioService = require('../services/pydioService');
let GoogleGenerativeAI = null;
try { GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI; } catch(e) {}

exports.index = async (req, res) => {
  try {
    const [webdavConfig, wpConfig, pydioConfig, timezone, geminiApiKey, geminiModel] = await Promise.all([
      WebDAVConfig.findOne({ order: [['id', 'DESC']] }),
      WordPressConfig.findOne({ order: [['id', 'DESC']] }),
      PydioConfig.findOne({ order: [['id', 'DESC']] }),
      Setting.get('timezone', 'America/Sao_Paulo'),
      Setting.get('gemini_api_key', ''),
      Setting.get('gemini_model', 'gemini-2.0-flash')
    ]);

    res.render('settings/index', {
      title: 'Configurações',
      webdavConfig: webdavConfig || {},
      wpConfig: wpConfig || {},
      pydioConfig: pydioConfig || {},
      timezone,
      geminiConfig: { api_key: geminiApiKey, model: geminiModel },
      message: req.query.message || null,
      messageType: req.query.type || 'info'
    });
  } catch (error) {
    console.error('[SETTINGS] Index error:', error);
    res.render('settings/index', {
      title: 'Configurações',
      webdavConfig: {}, wpConfig: {}, pydioConfig: {},
      timezone: 'America/Sao_Paulo',
      geminiConfig: { api_key: '', model: 'gemini-2.0-flash' },
      message: 'Error loading settings', messageType: 'error'
    });
  }
};

exports.saveWebDAV = async (req, res) => {
  try {
    const { server_url, username, password } = req.body;
    let config = await WebDAVConfig.findOne({ order: [['id', 'DESC']] });

    const data = { server_url, username, password_encrypted: password };

    if (config) {
      if (!password) delete data.password_encrypted;
      await config.update(data);
    } else {
      config = await WebDAVConfig.create(data);
    }

    webdavService.clearCache();
    res.redirect('/settings?message=WebDAV configuration saved&type=success');
  } catch (error) {
    console.error('[SETTINGS] WebDAV save error:', error);
    res.redirect('/settings?message=Error saving WebDAV config&type=error');
  }
};

exports.testWebDAV = async (req, res) => {
  try {
    const { server_url, username, password } = req.body;
    const result = await webdavService.testConnection(server_url, username, password);

    if (result.success) {
      let config = await WebDAVConfig.findOne({ order: [['id', 'DESC']] });
      if (config) {
        await config.update({ is_active: true, last_checked: new Date() });
      }
    }

    res.json(result);
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

exports.saveWordPress = async (req, res) => {
  try {
    const { site_url, consumer_key, consumer_secret } = req.body;
    let config = await WordPressConfig.findOne({ order: [['id', 'DESC']] });

    const data = { site_url, consumer_key, consumer_secret };

    if (config) {
      await config.update(data);
    } else {
      config = await WordPressConfig.create(data);
    }

    wordpressService.clearCache();
    res.redirect('/settings?message=WordPress configuration saved&type=success');
  } catch (error) {
    console.error('[SETTINGS] WordPress save error:', error);
    res.redirect('/settings?message=Error saving WordPress config&type=error');
  }
};

exports.saveTimezone = async (req, res) => {
  try {
    const { timezone } = req.body;
    await Setting.set('timezone', timezone);
    res.redirect('/settings?message=Fuso horário salvo com sucesso&type=success');
  } catch (error) {
    console.error('[SETTINGS] Timezone save error:', error);
    res.redirect('/settings?message=Erro ao salvar fuso horário&type=error');
  }
};

exports.savePydio = async (req, res) => {
  try {
    const { base_url, username, password, workspace, warp_proxy_enabled, warp_proxy_port, cdn_proxy_url } = req.body;
    let config = await PydioConfig.findOne({ order: [['id', 'DESC']] });

    const data = {
      base_url: (base_url || '').trim(),
      username,
      password_encrypted: password,
      workspace: (workspace || 'personal-files').trim(),
      warp_proxy_enabled: warp_proxy_enabled === 'on' || warp_proxy_enabled === 'true',
      warp_proxy_port: parseInt(warp_proxy_port) || 40000,
      cdn_proxy_url: (cdn_proxy_url || '').trim() || null
    };

    if (config) {
      if (!password) delete data.password_encrypted;
      await config.update(data);
    } else {
      config = await PydioConfig.create(data);
    }

    pydioService.clearCache();
    res.redirect('/settings?message=Pydio configurado com sucesso&type=success');
  } catch (error) {
    console.error('[SETTINGS] Pydio save error:', error);
    res.redirect('/settings?message=Erro ao salvar Pydio&type=error');
  }
};

exports.testPydio = async (req, res) => {
  try {
    const { base_url, username, password } = req.body;
    const result = await pydioService.testConnection(base_url, username, password);

    if (result.success) {
      let config = await PydioConfig.findOne({ order: [['id', 'DESC']] });
      if (config) {
        await config.update({ is_active: true, last_checked: new Date() });
      }
    }

    res.json(result);
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

exports.testWarp = async (req, res) => {
  try {
    const { port } = req.body;
    const warpPort = parseInt(port) || 40000;
    const { SocksProxyAgent } = require('socks-proxy-agent');
    const http = require('http');
    const https = require('https');

    const agent = new SocksProxyAgent(`socks5://127.0.0.1:${warpPort}`);
    const startTime = Date.now();

    if (warpPort < 1024 || warpPort > 65535) {
      return res.json({ success: false, message: 'Porta invalida. Use entre 1024 e 65535.' });
    }

    const result = await new Promise((resolve, reject) => {
      const req = https.get('https://cloudflare.com/cdn-cgi/trace', { agent, timeout: 10000 }, (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          resolve({
            success: false,
            message: 'WARP SOCKS5 respondeu com HTTP ' + response.statusCode
          });
          return;
        }
        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          const latency = Date.now() - startTime;
          const ipMatch = data.match(/ip=([^\n]+)/);
          const warpMatch = data.match(/warp=([^\n]+)/);
          const warpMode = warpMatch ? warpMatch[1].trim() : 'off';
          if (warpMode === 'off') {
            resolve({
              success: false,
              warp_ip: ipMatch ? ipMatch[1].trim() : null,
              message: 'SOCKS5 acessivel mas WARP nao esta ativo (warp=' + warpMode + '). Verifique se o WARP esta conectado: warp-cli connect'
            });
          } else {
            resolve({
              success: true,
              warp_ip: ipMatch ? ipMatch[1].trim() : null,
              warp_mode: warpMode,
              latency_ms: latency,
              message: 'WARP conectado com sucesso (warp=' + warpMode + ')'
            });
          }
        });
      });
      req.on('error', (err) => {
        resolve({
          success: false,
          message: 'WARP SOCKS5 nao acessivel na porta ' + warpPort + ': ' + err.message
        });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          message: 'Timeout ao conectar no WARP SOCKS5 porta ' + warpPort
        });
      });
    });

    res.json(result);
  } catch (error) {
    res.json({ success: false, message: 'Erro ao testar WARP: ' + error.message });
  }
};

exports.testWordPress = async (req, res) => {
  try {
    const { site_url, consumer_key, consumer_secret } = req.body;
    const result = await wordpressService.testConnection(site_url, consumer_key, consumer_secret);

    if (result.success) {
      let config = await WordPressConfig.findOne({ order: [['id', 'DESC']] });
      if (config) {
        await config.update({ is_active: true, last_synced: new Date() });
      }
    }

    res.json(result);
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

exports.saveGemini = async (req, res) => {
  try {
    const { api_key, model } = req.body;
    if (api_key) {
      await Setting.set('gemini_api_key', api_key);
    }
    await Setting.set('gemini_model', model || 'gemini-2.0-flash');
    res.redirect('/settings?message=Configuração do Gemini salva com sucesso&type=success');
  } catch (error) {
    console.error('[SETTINGS] Gemini save error:', error);
    res.redirect('/settings?message=Erro ao salvar configuração do Gemini&type=error');
  }
};

exports.testGemini = async (req, res) => {
  try {
    if (!GoogleGenerativeAI) {
      return res.json({ success: false, message: 'Pacote @google/generative-ai não instalado. Execute: npm install @google/generative-ai' });
    }
    let { api_key, model } = req.body;
    if (!api_key) {
      api_key = await Setting.get('gemini_api_key', '');
    }
    if (!api_key) {
      return res.json({ success: false, message: 'API Key não configurada' });
    }
    model = model || 'gemini-2.0-flash';
    const genAI = new GoogleGenerativeAI(api_key);
    const genModel = genAI.getGenerativeModel({ model });
    const result = await genModel.generateContent('Responda apenas com: OK');
    const response = result.response.text();
    res.json({ success: true, message: 'Conexão com Gemini OK! Modelo: ' + model });
  } catch (error) {
    res.json({ success: false, message: 'Erro ao conectar: ' + error.message });
  }
};
