const Setting = require('../models/Setting');

let GoogleGenerativeAI = null;

function loadGeminiSDK() {
  if (GoogleGenerativeAI) return true;
  try {
    GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
    return true;
  } catch (e) {
    return false;
  }
}

async function getGameInfo(gameTitle, titleId) {
  try {
    if (!loadGeminiSDK()) {
      return { success: false, error: 'Google Generative AI package not installed. Run: npm install @google/generative-ai' };
    }

    const apiKey = await Setting.get('gemini_api_key');
    if (!apiKey) {
      return { success: false, error: 'Gemini API key not configured' };
    }

    const model = await Setting.get('gemini_model', 'gemini-2.0-flash');

    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel({ model });

    const prompt = `You are a video game database expert. Given the following Xbox 360 game title and optional title ID, return accurate metadata about the game.

Game Title: ${gameTitle}
Title ID: ${titleId || 'unknown'}

Return ONLY a valid JSON object with these fields:
- "description": A brief description of the game in Brazilian Portuguese (pt-BR), approximately 200 characters
- "publisher": The game's publisher name
- "developer": The game's developer name
- "release_date": The game's release date in YYYY-MM-DD format

If you cannot find accurate information for a field, use null for that field.
Do not include any text outside the JSON object. Do not use markdown code blocks.`;

    const result = await geminiModel.generateContent(prompt);
    const response = result.response;
    const text = response.text().trim();

    const cleanText = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    const gameInfo = JSON.parse(cleanText);

    return {
      success: true,
      data: {
        description: gameInfo.description || null,
        publisher: gameInfo.publisher || null,
        developer: gameInfo.developer || null,
        release_date: gameInfo.release_date || null
      }
    };
  } catch (error) {
    if (error.message && error.message.includes('API_KEY_INVALID')) {
      return { success: false, error: 'Invalid Gemini API key' };
    }
    if (error.status === 429 || (error.message && error.message.includes('429'))) {
      return { success: false, error: 'Gemini API rate limit exceeded. Try again later.' };
    }
    if (error instanceof SyntaxError) {
      return { success: false, error: 'Failed to parse Gemini response as JSON' };
    }
    return { success: false, error: `Gemini API error: ${error.message}` };
  }
}

module.exports = { getGameInfo };
