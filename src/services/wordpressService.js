const axios = require('axios');
const { WordPressConfig } = require('../models');

let membersCache = null;
let membersCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;
let discoveredEndpoint = null;

async function getConfig() {
  return WordPressConfig.findOne({ order: [['id', 'DESC']] });
}

function getAuthHeaders(config) {
  if (config.consumer_key && config.consumer_secret) {
    return {
      'Authorization': `Basic ${Buffer.from(`${config.consumer_key}:${config.consumer_secret}`).toString('base64')}`
    };
  }
  return {};
}

async function testConnection(siteUrl, consumerKey, consumerSecret) {
  try {
    const headers = {};
    if (consumerKey && consumerSecret) {
      headers['Authorization'] = `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`;
    }
    const response = await axios.get(`${siteUrl}/wp-json/`, {
      headers,
      timeout: 10000
    });
    return {
      success: true,
      message: `Connected to ${response.data.name || siteUrl}`,
      siteName: response.data.name
    };
  } catch (error) {
    return { success: false, message: `Connection failed: ${error.message}` };
  }
}

const MEMBER_ENDPOINTS = [
  { path: '/wp-json/godsend/v1/members', name: 'GODSend Plugin', isGodsend: true, params: { per_page: 1 } },
  { path: '/wp-json/pmpro/v2/members', name: 'PMPro v2' },
  { path: '/wp-json/pmpro/v1/members', name: 'PMPro v1' },
  { path: '/wp-json/wp/v2/users', name: 'WP Users', params: { per_page: 100, context: 'edit' } },
  { path: '/wp-json/wp/v2/users', name: 'WP Users (view)', params: { per_page: 100 } },
];

async function discoverMemberEndpoint(config) {
  const headers = getAuthHeaders(config);

  for (const ep of MEMBER_ENDPOINTS) {
    try {
      const params = ep.params || (ep.isGodsend ? {} : { per_page: 100, status: 'active' });
      const response = await axios.get(`${config.site_url}${ep.path}`, {
        headers,
        timeout: 15000,
        params
      });

      if (response.status === 200) {
        console.log(`[WP] Discovered working endpoint: ${ep.name} (${ep.path})`);
        return { endpoint: ep, data: response.data };
      }
    } catch (error) {
      const status = error.response ? error.response.status : 'network';
      console.log(`[WP] Endpoint ${ep.name} (${ep.path}): ${status}`);

      if (error.response && error.response.status === 401) {
        return { error: 'Authentication failed. Check your Consumer Key and Consumer Secret.' };
      }
      if (error.response && error.response.status === 403) {
        continue;
      }
    }
  }

  return { error: 'No compatible member endpoint found. Install the GODSend API Bridge plugin on WordPress for best results.' };
}

function parseGodsendMembers(data) {
  const members = data.members || [];
  console.log(`[WP] GODSend: ${members.length} members loaded (total=${data.total}, pmpro=${data.has_pmpro})`);
  return {
    members: members.map(m => ({
      id: m.id,
      username: m.username || '',
      email: m.email || '',
      name: m.name || m.username || '',
      membership_level: m.level_name || null,
      level_id: m.level_id || null,
      status: m.status || 'active',
      registered: m.registered || null
    })),
    total: data.total || members.length,
    hasPmpro: data.has_pmpro || false,
    serverPaginated: true
  };
}

function parseGenericMembers(data) {
  let rawMembers = [];
  if (Array.isArray(data)) {
    rawMembers = data;
  } else if (data && data.members && Array.isArray(data.members)) {
    rawMembers = data.members;
  } else if (data && data.results && Array.isArray(data.results)) {
    rawMembers = data.results;
  }

  const members = rawMembers.map(m => {
    let memberName = '';
    if (typeof m.name === 'string') memberName = m.name;
    else if (m.display_name) memberName = m.display_name;
    else if (m.username) memberName = m.username;
    else if (m.user_login) memberName = m.user_login;

    let level = null;
    if (m.membership_level) {
      if (typeof m.membership_level === 'object') {
        level = m.membership_level.name || m.membership_level.Name || JSON.stringify(m.membership_level);
      } else {
        level = String(m.membership_level);
      }
    } else if (m.membership) {
      level = typeof m.membership === 'object' ? (m.membership.name || JSON.stringify(m.membership)) : String(m.membership);
    } else if (m.level) {
      level = typeof m.level === 'object' ? (m.level.name || JSON.stringify(m.level)) : String(m.level);
    } else if (m.roles && Array.isArray(m.roles) && m.roles.length > 0) {
      level = m.roles.join(', ');
    }

    return {
      id: m.id || m.user_id,
      username: m.username || m.user_login || m.login || m.slug || ('User #' + (m.id || m.user_id)),
      email: m.email || m.user_email || '',
      name: memberName || ('User #' + (m.id || m.user_id)),
      membership_level: level,
      level_id: null,
      status: m.status || 'active',
      registered: m.registered || m.user_registered || m.startdate || m.registered_date || null
    };
  });

  return {
    members,
    total: members.length,
    hasPmpro: false,
    serverPaginated: false
  };
}

async function fetchAllGodsendPages(config, headers, endpoint) {
  const PAGE_SIZE = 500;
  const firstResponse = await axios.get(`${config.site_url}${endpoint.path}`, {
    headers,
    timeout: 30000,
    params: { per_page: PAGE_SIZE, page: 1 }
  });

  const firstData = firstResponse.data;
  const total = firstData.total || 0;
  const totalPages = firstData.pages || Math.ceil(total / PAGE_SIZE);
  let allMembers = firstData.members || [];

  console.log(`[WP] GODSend page 1: ${allMembers.length} members, total=${total}, pages=${totalPages}`);

  for (let page = 2; page <= totalPages; page++) {
    try {
      const response = await axios.get(`${config.site_url}${endpoint.path}`, {
        headers,
        timeout: 30000,
        params: { per_page: PAGE_SIZE, page }
      });
      const pageMembers = response.data.members || [];
      console.log(`[WP] GODSend page ${page}: ${pageMembers.length} members`);
      allMembers = allMembers.concat(pageMembers);
    } catch (e) {
      console.error(`[WP] GODSend page ${page} failed: ${e.message}`);
    }
  }

  return {
    success: true,
    total,
    pages: totalPages,
    per_page: PAGE_SIZE,
    has_pmpro: firstData.has_pmpro || false,
    members: allMembers
  };
}

async function getMembers(forceRefresh = false) {
  if (!forceRefresh && membersCache && Date.now() - membersCacheTime < CACHE_DURATION) {
    return membersCache;
  }

  const config = await getConfig();
  if (!config || !config.is_active) {
    return { success: false, members: [], total: 0, message: 'WordPress not configured', serverPaginated: false };
  }

  try {
    const headers = getAuthHeaders(config);
    let responseData = null;
    let usedEndpoint = null;

    if (discoveredEndpoint) {
      try {
        if (discoveredEndpoint.isGodsend) {
          responseData = await fetchAllGodsendPages(config, headers, discoveredEndpoint);
        } else {
          const params = discoveredEndpoint.params || { per_page: 100, status: 'active' };
          const response = await axios.get(`${config.site_url}${discoveredEndpoint.path}`, {
            headers,
            timeout: 15000,
            params
          });
          responseData = response.data;
        }
        usedEndpoint = discoveredEndpoint;
      } catch (e) {
        console.log(`[WP] Cached endpoint failed, re-discovering...`);
        discoveredEndpoint = null;
      }
    }

    if (!responseData) {
      const discovery = await discoverMemberEndpoint(config);

      if (discovery.error) {
        if (membersCache) return membersCache;
        return { success: false, members: [], total: 0, message: discovery.error, serverPaginated: false };
      }

      discoveredEndpoint = discovery.endpoint;
      usedEndpoint = discovery.endpoint;

      if (usedEndpoint.isGodsend) {
        responseData = await fetchAllGodsendPages(config, headers, usedEndpoint);
      } else {
        responseData = discovery.data;
      }
    }

    let parsed;
    if (usedEndpoint.isGodsend) {
      parsed = parseGodsendMembers(responseData);
    } else {
      parsed = parseGenericMembers(responseData);
    }

    const source = usedEndpoint.name;
    const pmproNote = parsed.hasPmpro ? ' (PMPro)' : '';

    membersCache = {
      success: true,
      members: parsed.members,
      total: parsed.total,
      message: `${parsed.total} users found via ${source}${pmproNote}`,
      serverPaginated: parsed.serverPaginated,
      source: source
    };
    membersCacheTime = Date.now();

    await config.update({ last_synced: new Date() });

    return membersCache;
  } catch (error) {
    console.error('[WP] getMembers error:', error.message);
    if (membersCache) return membersCache;
    return { success: false, members: [], total: 0, message: `Failed to fetch members: ${error.message}`, serverPaginated: false };
  }
}

function clearCache() {
  membersCache = null;
  membersCacheTime = 0;
  discoveredEndpoint = null;
}

module.exports = { getConfig, testConnection, getMembers, clearCache };
