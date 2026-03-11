const axios = require('axios');
const https = require('https');
const http = require('http');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { PydioConfig } = require('../models');

let jwtCache = null;
let jwtExpiry = 0;
let configCache = null;
let lastLoginMethod = null;

async function getConfig() {
  const config = await PydioConfig.findOne({ order: [['id', 'DESC']] });
  return config;
}

function clearCache() {
  jwtCache = null;
  jwtExpiry = 0;
  configCache = null;
  lastLoginMethod = null;
}

async function loginViaFrontendSession(baseUrl, username, password) {
  const loginUrl = baseUrl + '/a/frontend/session';
  console.log('[PYDIO] Tentando login via /a/frontend/session...');

  const response = await axios.post(loginUrl, {
    AuthInfo: {
      login: username,
      password: password,
      type: 'credentials'
    }
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    timeout: 15000
  });

  if (response.data && response.data.JWT) {
    return response.data.JWT;
  }
  if (response.data && response.data.Token) {
    return response.data.Token;
  }
  throw new Error('JWT not found in response');
}

async function loginViaDexToken(baseUrl, username, password) {
  console.log('[PYDIO] Tentando login via /auth/dex/token (OIDC password grant)...');

  const tokenUrl = baseUrl + '/auth/dex/token';
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('username', username);
  params.append('password', password);
  params.append('scope', 'openid email profile pydio offline');
  params.append('nonce', Date.now().toString());

  const response = await axios.post(tokenUrl, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    timeout: 15000
  });

  if (response.data && response.data.id_token) {
    return response.data.id_token;
  }
  if (response.data && response.data.access_token) {
    return response.data.access_token;
  }
  throw new Error('Token not found in OIDC response');
}

async function loginViaWebForm(baseUrl, username, password) {
  console.log('[PYDIO] Tentando login via formulário web /login...');

  const jar = {};

  const loginPageRes = await axios.get(baseUrl + '/login', {
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: () => true,
    headers: {
      'Accept': 'text/html,application/xhtml+xml',
      'User-Agent': 'GODSend-CMS/1.0'
    }
  });

  if (loginPageRes.headers['set-cookie']) {
    for (const c of loginPageRes.headers['set-cookie']) {
      const parts = c.split(';')[0].split('=');
      if (parts.length >= 2) {
        jar[parts[0].trim()] = parts.slice(1).join('=').trim();
      }
    }
  }

  const cookieStr = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');

  const callbackRes = await axios.post(baseUrl + '/auth/dex/callback', new URLSearchParams({
    login: username,
    password: password
  }).toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieStr,
      'Referer': baseUrl + '/login',
      'User-Agent': 'GODSend-CMS/1.0'
    },
    timeout: 15000,
    maxRedirects: 0,
    validateStatus: (s) => s < 500
  });

  const allCookies = [];
  if (callbackRes.headers['set-cookie']) {
    allCookies.push(...callbackRes.headers['set-cookie']);
  }

  for (const c of allCookies) {
    const match = c.match(/pydio_jwt=([^;]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }

  if (callbackRes.status >= 300 && callbackRes.status < 400 && callbackRes.headers.location) {
    const redirectUrl = callbackRes.headers.location.startsWith('http')
      ? callbackRes.headers.location
      : baseUrl + callbackRes.headers.location;

    const redirectRes = await axios.get(redirectUrl, {
      headers: {
        'Cookie': cookieStr,
        'User-Agent': 'GODSend-CMS/1.0'
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true
    });

    if (redirectRes.headers['set-cookie']) {
      for (const c of redirectRes.headers['set-cookie']) {
        const match = c.match(/pydio_jwt=([^;]+)/);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
  }

  throw new Error('Could not extract pydio_jwt from web login flow');
}

async function loginViaOIDCFlow(baseUrl, username, password) {
  console.log('[PYDIO] Tentando login via fluxo OIDC completo...');

  const authRes = await axios.get(baseUrl + '/oidc/oauth2/auth', {
    params: {
      response_type: 'code',
      client_id: 'cells-frontend',
      redirect_uri: baseUrl + '/auth/callback',
      scope: 'openid email profile pydio offline',
      state: 'godsend_' + Date.now(),
      nonce: Date.now().toString()
    },
    headers: {
      'Accept': 'text/html,application/json',
      'User-Agent': 'GODSend-CMS/1.0'
    },
    timeout: 15000,
    maxRedirects: 0,
    validateStatus: (s) => s < 500
  });

  const jar = {};
  if (authRes.headers['set-cookie']) {
    for (const c of authRes.headers['set-cookie']) {
      const parts = c.split(';')[0].split('=');
      if (parts.length >= 2) {
        jar[parts[0].trim()] = parts.slice(1).join('=').trim();
      }
    }
  }

  let loginAction = baseUrl + '/auth/dex/callback';
  if (authRes.headers.location) {
    loginAction = authRes.headers.location.startsWith('http')
      ? authRes.headers.location
      : baseUrl + authRes.headers.location;
  }

  const cookieStr = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');

  const loginRes = await axios.post(loginAction, new URLSearchParams({
    login: username,
    password: password
  }).toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieStr,
      'Referer': baseUrl + '/login',
      'User-Agent': 'GODSend-CMS/1.0'
    },
    timeout: 15000,
    maxRedirects: 10,
    validateStatus: () => true
  });

  const allCookies = loginRes.headers['set-cookie'] || [];
  for (const c of allCookies) {
    const match = c.match(/pydio_jwt=([^;]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }

  throw new Error('Could not extract pydio_jwt from OIDC flow');
}

const LOGIN_METHODS = [
  { name: 'API REST (/a/frontend/session)', fn: loginViaFrontendSession },
  { name: 'OIDC Password Grant (/auth/dex/token)', fn: loginViaDexToken },
  { name: 'Web Login Form (/login)', fn: loginViaWebForm },
  { name: 'OIDC Full Flow (/oidc/oauth2/auth)', fn: loginViaOIDCFlow }
];

async function login(config) {
  const baseUrl = config.base_url.replace(/\/+$/, '');
  const username = config.username;
  const password = config.password_encrypted;

  const errors = [];

  for (const method of LOGIN_METHODS) {
    try {
      const jwt = await method.fn(baseUrl, username, password);
      if (jwt) {
        console.log('[PYDIO] Login bem-sucedido via: ' + method.name);
        lastLoginMethod = method.name;
        return jwt;
      }
    } catch (err) {
      const detail = err.response
        ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data || '').substring(0, 200)}`
        : err.message;
      console.log('[PYDIO] Falha ' + method.name + ': ' + detail);
      errors.push(method.name + ' -> ' + detail);
    }
  }

  throw new Error('Todos os métodos de login falharam:\n' + errors.join('\n'));
}

async function getJWT(config) {
  const now = Date.now();
  if (jwtCache && jwtExpiry > now && configCache && configCache.id === config.id) {
    return jwtCache;
  }

  const jwt = await login(config);
  jwtCache = jwt;
  jwtExpiry = now + (25 * 60 * 1000);
  configCache = config;
  return jwt;
}

async function testConnection(baseUrl, username, password) {
  const cleanBaseUrl = baseUrl.replace(/\/+$/, '').replace(/\/io\/?$/, '');
  const errors = [];
  let successMethod = null;
  let jwt = null;

  for (const method of LOGIN_METHODS) {
    try {
      jwt = await method.fn(cleanBaseUrl, username, password);
      if (jwt) {
        successMethod = method.name;
        break;
      }
    } catch (err) {
      const detail = err.response
        ? `HTTP ${err.response.status}: ${err.response.statusText}`
        : err.message;
      errors.push(method.name + ': ' + detail);
    }
  }

  if (successMethod && jwt) {
    const sampleUrl = cleanBaseUrl + '/io/personal-files/example.zip?pydio_jwt=' + jwt.substring(0, 20) + '...';
    return {
      success: true,
      message: 'Conectado via ' + successMethod,
      method: successMethod,
      sample_url: sampleUrl,
      jwt_preview: jwt.substring(0, 30) + '...'
    };
  }

  return {
    success: false,
    message: 'Falha em todos os métodos:\n' + errors.join('\n'),
    errors: errors
  };
}

function cleanFilePath(filePath, workspace) {
  let cleanPath = filePath || '';
  cleanPath = cleanPath.replace(/\\/g, '/');

  const wsSlug = workspace.replace(/^\/+|\/+$/g, '');
  let prev = '';
  while (prev !== cleanPath) {
    prev = cleanPath;

    while (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.substring(1);
    }

    if (cleanPath.startsWith('dav/')) {
      cleanPath = cleanPath.substring(4);
    }

    while (cleanPath.startsWith('io/')) {
      cleanPath = cleanPath.substring(3);
    }

    const wsPrefix = wsSlug + '/';
    while (cleanPath.startsWith(wsPrefix)) {
      cleanPath = cleanPath.substring(wsPrefix.length);
    }

    const wsWebdav = 'ws-' + wsSlug + '/';
    while (cleanPath.startsWith(wsWebdav)) {
      cleanPath = cleanPath.substring(wsWebdav.length);
    }
  }

  return cleanPath;
}

function buildDownloadUrl(config, jwt, filePath, fileName, options) {
  const forceHttps = options && options.forceHttps;
  const useCdn = options && options.useCdn;

  let baseUrl;
  if (useCdn && config.cdn_proxy_url) {
    baseUrl = config.cdn_proxy_url.replace(/\/+$/, '');
  } else {
    baseUrl = config.base_url.replace(/\/+$/, '');
    baseUrl = baseUrl.replace(/\/io\/?$/, '');
    if (forceHttps) {
      baseUrl = baseUrl.replace(/^http:\/\//i, 'https://');
    } else {
      baseUrl = baseUrl.replace(/^https:\/\//i, 'http://');
    }
  }

  const workspace = (config.workspace || 'personal-files').replace(/^\/+|\/+$/g, '');
  const cleanPath = cleanFilePath(filePath, workspace);
  const encodedPath = cleanPath.split('/').map(s => encodeURIComponent(s)).join('/');
  const disposition = encodeURIComponent('attachment; filename=' + (fileName || 'download'));

  const url = baseUrl + '/io/' + workspace + '/' + encodedPath
    + '?pydio_jwt=' + encodeURIComponent(jwt)
    + '&response-content-disposition=' + disposition;

  return url;
}

async function generateDirectUrl(serverPath, fileName, options) {
  const config = await getConfig();
  if (!config || !config.is_active) {
    return null;
  }

  try {
    const jwt = await getJWT(config);
    const url = buildDownloadUrl(config, jwt, serverPath, fileName, options);
    console.log('[PYDIO] URL gerada:', url.substring(0, 120) + '...');
    return url;
  } catch (error) {
    console.error('[PYDIO] Error generating direct URL:', error.message);
    return null;
  }
}

async function generateDirectUrls(serverPath, files, baseName, options) {
  const config = await getConfig();
  if (!config || !config.is_active) {
    return null;
  }

  try {
    const jwt = await getJWT(config);
    const urls = files.map(f => {
      let fullPath = serverPath;
      if (f.relative_path) {
        fullPath = serverPath.replace(/\/$/, '') + '/' + f.relative_path;
      }
      fullPath = fullPath.replace(/\/$/, '') + '/' + f.name;

      return {
        index: f.index,
        name: f.name,
        relative_path: f.relative_path || '',
        size: f.size || 0,
        direct_url: buildDownloadUrl(config, jwt, fullPath, f.name, options)
      };
    });
    return urls;
  } catch (error) {
    console.error('[PYDIO] Error generating direct URLs:', error.message);
    return null;
  }
}

async function hasCdnProxy() {
  const config = await getConfig();
  return !!(config && config.is_active && config.cdn_proxy_url);
}

async function isActive() {
  const config = await getConfig();
  return !!(config && config.is_active);
}

async function isWarpEnabled() {
  const config = await getConfig();
  return !!(config && config.is_active && config.warp_proxy_enabled);
}

async function generateDirectUrlHttps(serverPath, fileName) {
  const config = await getConfig();
  if (!config || !config.is_active) {
    return null;
  }

  try {
    const jwt = await getJWT(config);
    const url = buildDownloadUrl(config, jwt, serverPath, fileName, { forceHttps: true });
    console.log('[PYDIO] HTTPS URL gerada (WARP):', url.substring(0, 120) + '...');
    return url;
  } catch (error) {
    console.error('[PYDIO] Error generating HTTPS URL:', error.message);
    return null;
  }
}

async function streamViaWarp(downloadUrl, res, fileName, fileSize) {
  const config = await getConfig();
  if (!config || !config.warp_proxy_enabled) {
    throw new Error('WARP proxy not enabled');
  }

  const warpPort = config.warp_proxy_port || 40000;
  const agent = new SocksProxyAgent(`socks5://127.0.0.1:${warpPort}`);

  console.log('[PYDIO] Streaming via WARP (SOCKS5 port ' + warpPort + '):', downloadUrl.substring(0, 100) + '...');

  return new Promise((resolve, reject) => {
    let redirectCount = 0;
    const maxRedirects = 5;
    let settled = false;

    function settle(type, value) {
      if (settled) return;
      settled = true;
      if (type === 'resolve') resolve(value);
      else reject(value);
    }

    function doRequest(url) {
      let parsed;
      try {
        parsed = new URL(url);
      } catch (e) {
        settle('reject', new Error('Invalid URL: ' + url));
        return;
      }

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        agent: agent,
        headers: {
          'User-Agent': 'GODSend-CMS/2.0',
          'Accept-Encoding': 'identity',
          'Host': parsed.hostname
        }
      };

      const reqTransport = parsed.protocol === 'https:' ? https : http;

      const req = reqTransport.request(options, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          redirectCount++;
          if (redirectCount > maxRedirects) {
            response.resume();
            settle('reject', new Error('Too many redirects'));
            return;
          }
          response.resume();
          let redirectUrl;
          try {
            redirectUrl = new URL(response.headers.location, parsed).href;
          } catch (e) {
            settle('reject', new Error('Invalid redirect URL: ' + response.headers.location));
            return;
          }
          doRequest(redirectUrl);
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          settle('reject', new Error(`WARP request failed: HTTP ${response.statusCode}`));
          return;
        }

        const contentLength = response.headers['content-length'] || fileSize;

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName || 'download'}"`);
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Content-Encoding', 'identity');
        res.setHeader('Connection', 'keep-alive');
        if (contentLength) {
          res.setHeader('Content-Length', contentLength);
        }

        settle('resolve', response);
      });

      req.on('error', (err) => {
        settle('reject', err);
      });

      req.setTimeout(0);
      req.end();
    }

    doRequest(downloadUrl);
  });
}

module.exports = {
  getConfig,
  testConnection,
  generateDirectUrl,
  generateDirectUrls,
  generateDirectUrlHttps,
  isActive,
  isWarpEnabled,
  hasCdnProxy,
  streamViaWarp,
  clearCache
};
