const { createClient } = require('webdav');
const axios = require('axios');
const { WebDAVConfig } = require('../models');

let clientCache = null;
let configCache = null;

async function getConfig() {
  const config = await WebDAVConfig.findOne({ order: [['id', 'DESC']] });
  return config;
}

function createWebDAVClient(config) {
  const options = {};
  if (config.username && config.password_encrypted) {
    options.username = config.username;
    options.password = config.password_encrypted;
  }
  options.headers = { 'Connection': 'keep-alive' };
  return createClient(config.server_url, options);
}

async function getClient() {
  const config = await getConfig();
  if (!config) return null;
  if (clientCache && configCache && configCache.id === config.id && configCache.updated_at === config.updated_at) {
    return clientCache;
  }
  clientCache = createWebDAVClient(config);
  configCache = config;
  return clientCache;
}

async function testConnection(serverUrl, username, password) {
  try {
    const options = {};
    if (username && password) {
      options.username = username;
      options.password = password;
    }
    const client = createClient(serverUrl, options);
    const contents = await client.getDirectoryContents('/');
    return { success: true, message: `Connected. Found ${contents.length} items in root.` };
  } catch (error) {
    return { success: false, message: `Connection failed: ${error.message}` };
  }
}

async function listDirectory(path) {
  const client = await getClient();
  if (!client) throw new Error('WebDAV not configured');
  return client.getDirectoryContents(path || '/');
}

async function getFileStream(path) {
  const client = await getClient();
  if (!client) throw new Error('WebDAV not configured');
  return client.createReadStream(path);
}

async function getFileStreamDirect(filePath) {
  const config = await getConfig();
  if (!config) throw new Error('WebDAV not configured');

  const serverUrl = config.server_url.replace(/\/+$/, '');
  const encodedPath = filePath.split('/').map(s => encodeURIComponent(s)).join('/');
  const url = serverUrl + encodedPath;

  const headers = { 'Connection': 'keep-alive' };
  if (config.username && config.password_encrypted) {
    const basicAuth = Buffer.from(config.username + ':' + config.password_encrypted).toString('base64');
    headers['Authorization'] = 'Basic ' + basicAuth;
  }

  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    timeout: 0,
    maxContentLength: -1,
    maxBodyLength: -1,
    headers: headers,
    httpAgent: new (require('http').Agent)({ keepAlive: true }),
    httpsAgent: new (require('https').Agent)({ keepAlive: true }),
    decompress: false
  });

  return response.data;
}

async function getFileInfo(path) {
  const client = await getClient();
  if (!client) throw new Error('WebDAV not configured');
  return client.stat(path);
}

function clearCache() {
  clientCache = null;
  configCache = null;
}

module.exports = { getConfig, testConnection, listDirectory, getFileStream, getFileStreamDirect, getFileInfo, clearCache, getClient };
