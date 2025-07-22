// config.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

const ENV_GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const LLM_CHAT_ENABLED_ENV = process.env.EXPO_PUBLIC_LLM_CHAT_ENABLED;

let apiKey = ENV_GEMINI_API_KEY;

export const getApiKey = () => apiKey;
export const setApiKey = (key: string) => {
  apiKey = key;
};
export const clearApiKey = () => {
  apiKey = '';
};

export const initApiKey = async () => {
  const stored = await AsyncStorage.getItem('GEMINI_API_KEY');
  if (stored) {
    apiKey = stored;
  }
};

// Export all constants
export const GEMINI_UPLOAD_API_URL = 'https://api.google.com/gemini/v2/upload'; // Replace with actual Gemini upload URL
export const GEMINI_GENERATE_CONTENT_API_URL = 'https://api.google.com/gemini/v2/generateContent'; // Replace with actual Gemini generateContent URL

export const LLM_CHAT_ENABLED = LLM_CHAT_ENABLED_ENV === 'true' || false;
