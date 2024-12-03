import { GROQ_API_KEY } from '@env';
import { OPENAI_API_KEY as ENV_OPENAI_API_KEY } from '@env';

if (!GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY is not defined in .env file');
}

if (!ENV_OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not defined in .env file');
}

// Export all constants
export const API_KEY = GROQ_API_KEY;
export const OPENAI_API_KEY = ENV_OPENAI_API_KEY;
export const GROQ_WHISPER_API_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
export const OPENAI_CHAT_API_URL = 'https://api.openai.com/v1/chat/completions';
