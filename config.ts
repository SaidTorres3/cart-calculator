// config.ts

const ENV_GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const LLM_CHAT_ENABLED_ENV = process.env.EXPO_PUBLIC_LLM_CHAT_ENABLED;

if (!ENV_GEMINI_API_KEY) {
  throw new Error('EXPO_PUBLIC_GEMINI_API_KEY is not defined in .env file');
}

// Export all constants
export const API_KEY = ENV_GEMINI_API_KEY;
export const GEMINI_UPLOAD_API_URL = 'https://api.google.com/gemini/v2/upload'; // Replace with actual Gemini upload URL
export const GEMINI_GENERATE_CONTENT_API_URL = 'https://api.google.com/gemini/v2/generateContent'; // Replace with actual Gemini generateContent URL

export const LLM_CHAT_ENABLED = LLM_CHAT_ENABLED_ENV === 'true' || false;
