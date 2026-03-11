const axios = require('axios');

const descriptionCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

function buildProductId(titleId) {
  const hex = titleId.replace(/^0x/i, '').toLowerCase().padStart(8, '0');
  return '00000000-0000-4000-8000-0000' + hex;
}

function pickLocalization(localizations, preferredLocales) {
  if (!localizations || !localizations.length) return null;
  for (const pref of preferredLocales) {
    const loc = localizations.find(l => l.locale && l.locale.toLowerCase() === pref.toLowerCase());
    if (loc && (loc.full_description || loc.reduced_description)) return loc;
  }
  const withDesc = localizations.find(l => l.full_description || l.reduced_description);
  return withDesc || localizations[0] || null;
}

async function getDescription(titleId) {
  const cleanId = titleId.replace(/^0x/i, '').toUpperCase();
  const cacheKey = cleanId;

  const cached = descriptionCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  const productId = buildProductId(cleanId);
  const url = `https://dbox.tools/api/marketplace/products/${productId}`;

  try {
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GODSend CMS)',
        'Accept': 'application/json'
      }
    });

    const product = response.data;
    if (!product || product.detail === 'Not Found') {
      const result = null;
      descriptionCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    }

    const loc = pickLocalization(product.localizations || [], ['pt-br', 'pt-pt', 'en-us', 'en-gb']);

    const result = {
      description: loc ? (loc.full_description || loc.reduced_description || '') : '',
      title: product.default_title || (loc ? (loc.full_title || loc.reduced_title || '') : ''),
      developer: product.developer_name || '',
      publisher: product.publisher_name || '',
      release_date: product.global_original_release_date || product.visibility_date || ''
    };

    descriptionCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      descriptionCache.set(cacheKey, { data: null, timestamp: Date.now() });
      return null;
    }
    throw error;
  }
}

async function getDescriptionBatch(titleIds) {
  const results = {};
  const promises = titleIds.map(async (tid) => {
    try {
      results[tid] = await getDescription(tid);
    } catch (e) {
      results[tid] = null;
    }
  });
  await Promise.all(promises);
  return results;
}

module.exports = { getDescription, getDescriptionBatch };
